<?php
/**
 * AcoBot — AI Chat Backend (Google Gemini)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit(0); }

// ── Load .env ────────────────────────────────────────────────────
$env = [];
$envFile = __DIR__ . '/.env';
if (file_exists($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
        if (strpos(trim($line), '#') === 0 || strpos($line, '=') === false) continue;
        [$key, $val] = explode('=', $line, 2);
        $env[trim($key)] = trim($val);
    }
}

// ── Config ──────────────────────────────────────────────────────
$API_KEY = $env['GEMINI_API_KEY'] ?? '';
$MODEL   = 'gemini-2.5-flash';
$URL     = "https://generativelanguage.googleapis.com/v1beta/models/{$MODEL}:generateContent?key={$API_KEY}";
$TO_EMAIL = 'navas@directaxistech.com';

// ══════════════════════════════════════════════════════════════════
// EMAIL ENDPOINT  — POST chatbot.php?action=send_email
// ══════════════════════════════════════════════════════════════════
if (isset($_GET['action']) && $_GET['action'] === 'send_email') {
    $data      = json_decode(file_get_contents('php://input'), true);
    $messages  = $data['messages']  ?? [];
    $collected = $data['collected'] ?? [];
    $reason    = $data['reason']    ?? 'Chat ended';

    $company = trim($collected['company_name'] ?? '') ?: 'Unknown';
    $subject = "AcoBot Chat — {$company} (" . date('d M Y, H:i') . ")";

    // ── Plain-text body ──────────────────────────────────────────
    $body  = "ACOBOT CHAT TRANSCRIPT\n";
    $body .= str_repeat('=', 40) . "\n";
    $body .= "Date   : " . date('d M Y H:i:s') . "\n";
    $body .= "Reason : {$reason}\n\n";

    $body .= "COLLECTED INFORMATION\n";
    $body .= str_repeat('-', 40) . "\n";
    $labels = ['company_name' => 'Company', 'industry' => 'Industry',
               'email' => 'Email', 'software' => 'Current Software'];
    foreach ($labels as $key => $label) {
        $val = trim($collected[$key] ?? '');
        $body .= sprintf("%-18s: %s\n", $label, $val ?: '—');
    }

    $body .= "\nCONVERSATION\n";
    $body .= str_repeat('-', 40) . "\n";
    foreach ($messages as $m) {
        $role = $m['role'] === 'user' ? 'Customer' : 'AcoBot';
        $text = $m['content'] ?? '';
        // Extract readable reply from assistant JSON
        if ($m['role'] === 'assistant') {
            $p = json_decode($text, true);
            if ($p && isset($p['reply'])) $text = $p['reply'];
        }
        $text = html_entity_decode(strip_tags($text), ENT_QUOTES, 'UTF-8');
        $body .= "\n[{$role}]\n{$text}\n";
    }

    // ── HTML version ─────────────────────────────────────────────
    $html  = "<html><body style='font-family:Arial,sans-serif;color:#1e293b'>";
    $html .= "<h2 style='color:#1a3a5c'>AcoBot Chat Transcript</h2>";
    $html .= "<p><b>Date:</b> " . date('d M Y H:i:s') . " &nbsp;|&nbsp; <b>Reason:</b> {$reason}</p>";
    $html .= "<table style='border-collapse:collapse;margin-bottom:20px'>";
    foreach ($labels as $key => $label) {
        $val = htmlspecialchars(trim($collected[$key] ?? '') ?: '—');
        $html .= "<tr><td style='padding:4px 12px 4px 0;font-weight:bold'>{$label}</td><td>{$val}</td></tr>";
    }
    $html .= "</table><hr/><h3>Conversation</h3>";
    foreach ($messages as $m) {
        $role  = $m['role'] === 'user' ? 'Customer' : 'AcoBot';
        $color = $m['role'] === 'user' ? '#1a5fa8' : '#374151';
        $text  = $m['content'] ?? '';
        if ($m['role'] === 'assistant') {
            $p = json_decode($text, true);
            if ($p && isset($p['reply'])) $text = $p['reply'];
        }
        $text  = nl2br(htmlspecialchars(html_entity_decode(strip_tags($text), ENT_QUOTES, 'UTF-8')));
        $html .= "<p><strong style='color:{$color}'>[{$role}]</strong><br/>{$text}</p>";
    }
    $html .= "</body></html>";

    // ── Send email ───────────────────────────────────────────────
    $boundary = md5(time());
    $headers  = "From: AcoBot <noreply@acodax.com>\r\n";
    $headers .= "Reply-To: noreply@acodax.com\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";

    $mail_body  = "--{$boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n{$body}\r\n";
    $mail_body .= "--{$boundary}\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n{$html}\r\n";
    $mail_body .= "--{$boundary}--";

    $sent = @mail($TO_EMAIL, $subject, $mail_body, $headers);

    // Also save a local log as backup
    $logDir = __DIR__ . '/chat_logs';
    if (!is_dir($logDir)) @mkdir($logDir, 0755, true);
    $logFile = $logDir . '/chat_' . date('Ymd_His') . '_' . substr(md5($company), 0, 6) . '.txt';
    @file_put_contents($logFile, $body);

    echo json_encode(['success' => true, 'emailed' => $sent, 'logged' => file_exists($logFile)]);
    exit;
}

// ══════════════════════════════════════════════════════════════════
// CHAT ENDPOINT
// ══════════════════════════════════════════════════════════════════
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405); exit;
}

// ── Load knowledge file ──────────────────────────────────────────
$knowledgeFile = __DIR__ . '/knowledge/acodax.txt';
$knowledgeText = '';
if (file_exists($knowledgeFile)) {
    $knowledgeText = trim(file_get_contents($knowledgeFile));
}

// ── System Prompt ────────────────────────────────────────────────
$SYSTEM = "You are AcoBot, a support agent for Acodax ERP — an AI-powered ERP for UAE and Middle East businesses.

REPLY STYLE:
- Keep every reply to 1-2 short sentences max.
- Use simple, everyday English — no jargon, no long paragraphs.
- Sound like a friendly colleague texting, not a formal assistant.

YOUR JOB:
1. Answer questions about Acodax ERP (features, pricing, modules, VAT, integrations, etc.).
2. Collect these 4 details one at a time, naturally in conversation:
   - Company name
   - Industry (Trading, Retail, Service, Manufacturing, Real Estate, Construction, Healthcare, Others)
   - Current software they use (Zoho, Tally, SAP, QuickBooks, Excel, or nothing)
   - Email address

HOW TO ASK (casual, one at a time):
- Company: \"What's your company name?\"
- Industry: \"What type of business are you in?\"
- Software: \"Any software you're currently using — like Tally or Excel?\"
- Email: \"What email can we reach you on?\"

RULES:
- Answer first, then slip in one question.
- Never ask two things at once.
- Set show_industry_options true only when asking about industry.
- Once all 4 are collected, say thanks and tell them the team will be in touch.
- If the question is NOT related to ERP, business software, or Acodax — politely excuse yourself. Example: \"That's a bit outside my area! I'm only trained for ERP and business software topics. Anything I can help with on that front?\"

HISTORY: Read collected_data from your previous JSON replies — never ask for something already collected.
" . ($knowledgeText ? "\nKNOWLEDGE BASE:\n{$knowledgeText}\n" : "") . "
ALWAYS return valid JSON only — no markdown, no code fences:
{
  \"reply\": \"your message\",
  \"collected_data\": { \"company_name\": \"\", \"industry\": \"\", \"email\": \"\", \"software\": \"\" },
  \"show_industry_options\": false,
  \"completed\": false
}

Carry forward ALL collected values every turn. Set completed true only when all 4 fields are filled.";

// ── Input ────────────────────────────────────────────────────────
$body     = json_decode(file_get_contents('php://input'), true);
$messages = $body['messages'] ?? [];

$empty = ['company_name'=>'','industry'=>'','email'=>'','software'=>''];

if (empty($messages)) {
    echo json_encode([
        'reply'                 => "Hello! 👋 I'm AcoBot, your Acodax ERP support assistant. I'm here to help with any questions about our platform or to set up a free demo. How can I help you today?",
        'collected_data'        => $empty,
        'show_industry_options' => false,
        'completed'             => false
    ]);
    exit;
}

// ── Convert to Gemini format ─────────────────────────────────────
$geminiMessages = [];
foreach ($messages as $m) {
    $geminiMessages[] = [
        'role'  => $m['role'] === 'assistant' ? 'model' : 'user',
        'parts' => [['text' => $m['content']]]
    ];
}

$payload = [
    'system_instruction' => ['parts' => [['text' => $SYSTEM]]],
    'contents'           => $geminiMessages,
    'generationConfig'   => ['maxOutputTokens' => 512, 'temperature' => 0.7]
];

// ── Call Gemini ──────────────────────────────────────────────────
$ch = curl_init($URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json']
]);
$raw      = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
@curl_close($ch);

if ($raw === false || $httpCode !== 200) {
    echo json_encode(['reply'=>"Sorry, connection issue. Please try again!",
                      'collected_data'=>$empty,'show_industry_options'=>false,'completed'=>false]);
    exit;
}

$result = json_decode($raw, true);
$text   = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
$text   = preg_replace('/^```(?:json)?\s*/i', '', trim($text));
$text   = preg_replace('/\s*```$/', '', $text);

preg_match('/\{[\s\S]*\}/u', $text, $m2);
$parsed = !empty($m2[0]) ? json_decode($m2[0], true) : null;

if ($parsed && isset($parsed['reply'])) {
    $parsed['collected_data']        = array_merge($empty, $parsed['collected_data'] ?? []);
    $parsed['show_industry_options'] = (bool)($parsed['show_industry_options'] ?? false);
    $parsed['completed']             = (bool)($parsed['completed'] ?? false);
    echo json_encode($parsed);
} else {
    echo json_encode(['reply'=>$text ?: "How can I help you with Acodax ERP?",
                      'collected_data'=>$empty,'show_industry_options'=>false,'completed'=>false]);
}
