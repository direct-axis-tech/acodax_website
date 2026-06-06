<?php
/**
 * AcoBot Training Page — upload knowledge docs to train the chatbot
 */

$PASSWORD     = 'acodax2024';
$KNOWLEDGE    = __DIR__ . '/knowledge/acodax.txt';
$error        = '';
$success      = '';
$loggedIn     = isset($_SESSION['train_auth']) && $_SESSION['train_auth'] === true;

session_start();
$loggedIn = isset($_SESSION['train_auth']) && $_SESSION['train_auth'] === true;

// ── Login ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['password'])) {
    if ($_POST['password'] === $PASSWORD) {
        $_SESSION['train_auth'] = true;
        $loggedIn = true;
    } else {
        $error = 'Incorrect password.';
    }
}

// ── Logout ───────────────────────────────────────────────────────
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: train.php'); exit;
}

// ── Save knowledge ───────────────────────────────────────────────
if ($loggedIn && $_SERVER['REQUEST_METHOD'] === 'POST') {

    // Upload a .txt file
    if (!empty($_FILES['doc']['tmp_name'])) {
        $ext = strtolower(pathinfo($_FILES['doc']['name'], PATHINFO_EXTENSION));
        if ($ext === 'txt') {
            $content = file_get_contents($_FILES['doc']['tmp_name']);
            file_put_contents($KNOWLEDGE, $content);
            $success = 'Document uploaded and saved successfully.';
        } else {
            $error = 'Only .txt files are supported for upload.';
        }
    }
    // Paste / type text directly
    elseif (isset($_POST['knowledge_text'])) {
        $content = trim($_POST['knowledge_text']);
        file_put_contents($KNOWLEDGE, $content);
        $success = 'Knowledge base saved successfully.';
    }
}

$currentKnowledge = file_exists($KNOWLEDGE) ? trim(file_get_contents($KNOWLEDGE)) : '';
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>AcoBot Training — Acodax</title>
<script src="https://cdn.tailwindcss.com"></script>
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css"/>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif; }
</style>
</head>
<body class="bg-gray-50 min-h-screen flex items-center justify-center p-6">

<?php if (!$loggedIn): ?>
<!-- LOGIN -->
<div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 w-full max-w-sm">
  <div class="text-center mb-8">
    <div class="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
      <i class="fa-solid fa-robot text-2xl text-blue-500"></i>
    </div>
    <h1 class="text-xl font-bold text-gray-900">AcoBot Training</h1>
    <p class="text-sm text-gray-400 mt-1">Admin access required</p>
  </div>
  <?php if ($error): ?>
    <div class="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>
  <form method="POST">
    <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
    <input type="password" name="password" autofocus required
           class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 mb-4"/>
    <button type="submit"
            class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition">
      Sign In
    </button>
  </form>
</div>

<?php else: ?>
<!-- TRAINING PANEL -->
<div class="w-full max-w-2xl">
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-3">
      <div class="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
        <i class="fa-solid fa-robot text-blue-500"></i>
      </div>
      <div>
        <h1 class="text-lg font-bold text-gray-900">AcoBot Knowledge Base</h1>
        <p class="text-xs text-gray-400">Content here is injected into every chat</p>
      </div>
    </div>
    <a href="?logout" class="text-xs text-gray-400 hover:text-gray-600">Sign out</a>
  </div>

  <?php if ($success): ?>
    <div class="bg-green-50 text-green-700 text-sm rounded-xl px-4 py-3 mb-5 flex items-center gap-2">
      <i class="fa-solid fa-check-circle"></i> <?= htmlspecialchars($success) ?>
    </div>
  <?php endif; ?>
  <?php if ($error): ?>
    <div class="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-5"><?= htmlspecialchars($error) ?></div>
  <?php endif; ?>

  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

    <!-- Upload a file -->
    <div class="p-6 border-b border-gray-50">
      <h2 class="text-sm font-semibold text-gray-700 mb-1">Upload a .txt document</h2>
      <p class="text-xs text-gray-400 mb-4">Upload a plain text file — it will replace the current knowledge base.</p>
      <form method="POST" enctype="multipart/form-data" class="flex items-center gap-3">
        <input type="file" name="doc" accept=".txt" required
               class="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-blue-400"/>
        <button type="submit"
                class="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition whitespace-nowrap">
          <i class="fa-solid fa-upload mr-1"></i> Upload
        </button>
      </form>
    </div>

    <!-- Type / paste text -->
    <div class="p-6">
      <h2 class="text-sm font-semibold text-gray-700 mb-1">Or type / paste directly</h2>
      <p class="text-xs text-gray-400 mb-4">Write anything about Acodax — features, FAQs, pricing details, modules, etc.</p>
      <form method="POST">
        <textarea name="knowledge_text" rows="14"
                  placeholder="e.g. Acodax modules include Accounting, Inventory, Sales, HR & Payroll, CRM, Manufacturing...&#10;Pricing starts at AED 199/month for Starter plan...&#10;Supported integrations: WhatsApp, Stripe, UAE FTA VAT..."
                  class="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-400 resize-y font-mono leading-relaxed"><?= htmlspecialchars($currentKnowledge) ?></textarea>
        <div class="flex items-center justify-between mt-3">
          <span class="text-xs text-gray-400">
            <?= $currentKnowledge ? 'Last saved: ' . date('d M Y, H:i', filemtime($KNOWLEDGE)) : 'No knowledge base yet' ?>
          </span>
          <button type="submit"
                  class="bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition">
            <i class="fa-solid fa-floppy-disk mr-1"></i> Save
          </button>
        </div>
      </form>
    </div>
  </div>

  <p class="text-center text-xs text-gray-300 mt-5">Changes take effect immediately on the next chat message.</p>
</div>
<?php endif; ?>

</body>
</html>
