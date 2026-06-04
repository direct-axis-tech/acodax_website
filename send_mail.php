<?php
/**
 * Acodax Mail Handler
 * ─────────────────────────────────────────────────────────────
 * Handles form submissions from contact.html and partner.html.
 * Uses Gmail SMTP via PHPMailer. Credentials loaded from .env
 *
 * SETUP:
 *   1. Fill in GMAIL_USER and GMAIL_APP_KEY in .env
 *   2. Install PHPMailer:  composer require phpmailer/phpmailer
 *      OR download from https://github.com/PHPMailer/PHPMailer
 *      and place the /src folder next to this file as /PHPMailer/src/
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
$recipient = $env['MAIL_TO'] ?? 'info@directaxistech.com';

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

// ── Send via PHPMailer ────────────────────────────────────────
$sent = false;
$error = '';

// Try Composer autoload first, then manual path
$autoloads = [
    __DIR__ . '/vendor/autoload.php',
    __DIR__ . '/PHPMailer/src/PHPMailer.php',
];

$phpmailerAvailable = file_exists($autoloads[0]);

if ($phpmailerAvailable) {
    try {
        require_once $autoloads[0];
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        $mail->isSMTP();
        $mail->Host       = 'smtp.gmail.com';
        $mail->SMTPAuth   = true;
        $mail->Username   = $gmailUser;
        $mail->Password   = $gmailPass;
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port       = 587;
        $mail->CharSet    = 'UTF-8';

        $mail->setFrom($gmailUser ?: 'noreply@acodax.com', 'Acodax Website');
        $mail->addAddress($recipient, 'Direct Axis Tech');
        if (!empty($replyEmail)) $mail->addReplyTo($replyEmail);

        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body    = $bodyHtml;
        $mail->AltBody = strip_tags(str_replace(['<td', '<tr'], ["\n<td", "\n<tr"], $bodyHtml));

        $mail->send();
        $sent = true;
    } catch (\Exception $e) {
        $error = $e->getMessage();
    }
}

// Fallback: PHP mail()
if (!$sent) {
    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= "From: Acodax Website <noreply@acodax.com>\r\n";
    if (!empty($replyEmail)) $headers .= "Reply-To: {$replyEmail}\r\n";
    $sent  = mail($recipient, $subject, $bodyHtml, $headers);
    $error = $sent ? '' : 'PHP mail() failed. Configure SMTP or install PHPMailer.';
}

echo json_encode([
    'success' => $sent,
    'message' => $sent ? 'Your message has been sent successfully!' : 'Failed to send: ' . $error,
]);
