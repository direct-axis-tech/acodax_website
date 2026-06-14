<?php
/**
 * Acodax Mail Handler
 * ─────────────────────────────────────────────────────────────
 * Handles form submissions from contact.html and partner.html.
 * Sends via Gmail SMTP (STARTTLS + AUTH LOGIN) using a minimal
 * built-in client — no external libraries required.
 *
 * SETUP:
 *   Fill in GMAIL_USER and GMAIL_APP_KEY in .env (Gmail App Password,
 *   from https://myaccount.google.com/apppasswords)
 * ─────────────────────────────────────────────────────────────
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST')    { echo json_encode(['success'=>false,'message'=>'Method not allowed']); exit; }

// ── Load .env ─────────────────────────────────────────────────
$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        [$key, $val] = explode('=', $line, 2);
        $env[trim($key)] = trim($val);
    }
}

$gmailUser = $env['GMAIL_USER'] ?? '';
$gmailPass = $env['GMAIL_APP_KEY'] ?? '';
$recipient = $env['MAIL_TO'] ?? 'navas@directaxistech.com';

// ── Sanitize helper ───────────────────────────────────────────
function clean($v) { return htmlspecialchars(strip_tags(trim($v ?? ''))); }

// ── Determine form type & build data ─────────────────────────
$formType = clean($_POST['form_type'] ?? 'contact');

if ($formType === 'partner') {
    $fields = [
        'Company Name' => clean($_POST['company_name'] ?? ''),
        'Email'        => clean($_POST['email']        ?? ''),
        'Address'      => clean($_POST['address']      ?? ''),
        'Country'      => clean($_POST['country']      ?? ''),
        'Contact No'   => clean($_POST['contact_no']   ?? ''),
    ];
    $subject    = '🤝 New Partner Registration — ' . $fields['Company Name'];
    $replyEmail = $_POST['email'] ?? '';
} else {
    $fields = [
        'Name'      => clean($_POST['name']      ?? ''),
        'Company'   => clean($_POST['company']   ?? ''),
        'Email'     => clean($_POST['email']     ?? ''),
        'Phone'     => clean($_POST['phone']     ?? ''),
        'Enquiry'   => clean($_POST['interest']  ?? ''),
        'Message'   => clean($_POST['message']   ?? ''),
    ];
    $subject    = '📩 New Contact Form — ' . $fields['Name'];
    $replyEmail = $_POST['email'] ?? '';
}

// ── Build HTML email ──────────────────────────────────────────
$rows = '';
foreach ($fields as $label => $value) {
    if ($value === '') continue;
    $rows .= "<tr><td style='padding:8px 12px;font-weight:600;color:#424245;width:140px;white-space:nowrap'>{$label}</td>"
           . "<td style='padding:8px 12px;color:#1d1d1f'>{$value}</td></tr>";
}

$bodyHtml = <<<HTML
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:30px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">
    <div style="background:linear-gradient(135deg,#0071e3,#a855f7);padding:24px 28px">
      <img src="https://acodax.com/wp-content/uploads/2026/01/Acodax-logo-2.png" alt="Acodax" style="height:30px;margin-bottom:12px" onerror=""/>
      <h2 style="color:#fff;margin:0;font-size:1.2rem;font-weight:700">{$subject}</h2>
    </div>
    <div style="padding:24px 28px">
      <table style="width:100%;border-collapse:collapse">
        {$rows}
      </table>
    </div>
    <div style="background:#f5f5f7;padding:14px 28px;font-size:.78rem;color:#86868b">
      Submitted via Acodax website · <a href="https://acodax.com" style="color:#0071e3">acodax.com</a>
    </div>
  </div>
</body>
</html>
HTML;

// ── Send via Gmail SMTP (minimal built-in client, no dependencies) ──
$sent = false;
$error = '';

/**
 * Send one SMTP command (or just read a reply if $command is null) and
 * verify the reply code is one of $expectedCodes. Throws on mismatch.
 */
function smtp_expect($socket, $command, array $expectedCodes) {
    if ($command !== null) {
        fwrite($socket, $command . "\r\n");
    }
    $response = '';
    do {
        $line = fgets($socket, 515);
        if ($line === false) {
            throw new Exception('SMTP connection closed unexpectedly');
        }
        $response .= $line;
    } while (isset($line[3]) && $line[3] === '-');

    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $expectedCodes, true)) {
        throw new Exception('SMTP error: ' . trim($response));
    }
    return $response;
}

function smtp_send_mail($host, $port, $username, $password, $fromEmail, $fromName, $toEmail, $toName, $subject, $htmlBody, $altBody, $replyTo) {
    $socket = @stream_socket_client("tcp://{$host}:{$port}", $errno, $errstr, 15);
    if (!$socket) {
        throw new Exception("Could not connect to {$host}:{$port} — {$errstr} ({$errno})");
    }
    stream_set_timeout($socket, 15);

    $localHost = gethostname() ?: 'localhost';

    smtp_expect($socket, null, [220]);
    smtp_expect($socket, "EHLO {$localHost}", [250]);
    smtp_expect($socket, 'STARTTLS', [220]);

    if (!@stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
        throw new Exception('TLS handshake with SMTP server failed');
    }

    smtp_expect($socket, "EHLO {$localHost}", [250]);
    smtp_expect($socket, 'AUTH LOGIN', [334]);
    smtp_expect($socket, base64_encode($username), [334]);
    smtp_expect($socket, base64_encode(str_replace(' ', '', $password)), [235]);

    smtp_expect($socket, "MAIL FROM:<{$fromEmail}>", [250]);
    smtp_expect($socket, "RCPT TO:<{$toEmail}>", [250, 251]);
    smtp_expect($socket, 'DATA', [354]);

    $boundary = 'acodax-' . bin2hex(random_bytes(12));

    $headers   = [];
    $headers[] = 'Date: ' . date('r');
    $headers[] = 'To: ' . ($toName !== '' ? "{$toName} <{$toEmail}>" : $toEmail);
    $headers[] = 'From: ' . ($fromName !== '' ? "{$fromName} <{$fromEmail}>" : $fromEmail);
    if (!empty($replyTo)) {
        $headers[] = "Reply-To: {$replyTo}";
    }
    $headers[] = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';
    $headers[] = 'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . preg_replace('/^.*@/', '', $fromEmail) . '>';
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";

    $message  = implode("\r\n", $headers) . "\r\n\r\n";
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $message .= chunk_split(base64_encode($altBody));
    $message .= "--{$boundary}\r\n";
    $message .= "Content-Type: text/html; charset=UTF-8\r\n";
    $message .= "Content-Transfer-Encoding: base64\r\n\r\n";
    $message .= chunk_split(base64_encode($htmlBody));
    $message .= "--{$boundary}--\r\n";

    // Dot-stuff any line that begins with '.' per RFC 5321
    $message = preg_replace('/^\./m', '..', $message);

    fwrite($socket, $message);
    smtp_expect($socket, '.', [250]);

    smtp_expect($socket, 'QUIT', [221]);
    fclose($socket);

    return true;
}

try {
    if ($gmailUser === '' || $gmailPass === '') {
        throw new Exception('GMAIL_USER / GMAIL_APP_KEY not configured in .env');
    }
    smtp_send_mail(
        'smtp.gmail.com',
        587,
        $gmailUser,
        $gmailPass,
        $gmailUser,
        'Acodax Website',
        $recipient,
        'Direct Axis Tech',
        $subject,
        $bodyHtml,
        strip_tags(str_replace(['<td', '<tr'], ["\n<td", "\n<tr"], $bodyHtml)),
        $replyEmail
    );
    $sent = true;
} catch (\Exception $e) {
    $error = $e->getMessage();
}

echo json_encode([
    'success' => $sent,
    'message' => $sent ? 'Your message has been sent successfully!' : 'Failed to send: ' . $error,
]);
