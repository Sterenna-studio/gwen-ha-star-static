<?php
// Admin des styles de vinyles
error_reporting(E_ALL);
ini_set('display_errors', 0);

$root       = dirname(__DIR__);
$stylesFile = $root . '/vinyl_styles.json';

if (!file_exists($stylesFile)) {
    file_put_contents($stylesFile, json_encode([
        [ "id" => "effect-none",   "label" => "Classique sombre" ],
        [ "id" => "effect-calc",   "label" => "Calculs / Tech" ],
        [ "id" => "effect-bicolor","label" => "Bicolore" ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function read_styles($file){
    $raw = @file_get_contents($file);
    if(!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function write_styles($file, $styles){
    file_put_contents($file, json_encode($styles, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

$styles = read_styles($stylesFile);
$msg = '';

if($_SERVER['REQUEST_METHOD'] === 'POST'){
    $action = $_POST['action'] ?? '';
    if($action === 'add'){
        $id    = trim($_POST['id'] ?? '');
        $label = trim($_POST['label'] ?? '');
        if($id !== '' && $label !== ''){
            // éviter doublon
            $exists = false;
            foreach($styles as $s){
                if($s['id'] === $id){ $exists = true; break; }
            }
            if(!$exists){
                $styles[] = [ 'id' => $id, 'label' => $label ];
                write_styles($stylesFile, $styles);
                $msg = 'Style ajouté.';
            } else {
                $msg = 'ID déjà existant.';
            }
        } else {
            $msg = 'ID et label requis.';
        }
    }

    if($action === 'delete'){
        $id = $_POST['id'] ?? '';
        $styles = array_values(array_filter($styles, fn($s)=>$s['id'] !== $id));
        write_styles($stylesFile, $styles);
        $msg = 'Style supprimé.';
    }

    if($action === 'update'){
        $id = $_POST['id'] ?? '';
        $label = trim($_POST['label'] ?? '');
        foreach($styles as &$s){
            if($s['id'] === $id){
                $s['label'] = $label;
                break;
            }
        }
        unset($s);
        write_styles($stylesFile, $styles);
        $msg = 'Style mis à jour.';
    }

    // recharger après modif
    $styles = read_styles($stylesFile);
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Styles vinyle</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;background:#0d0f12;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu}
.wrap{max-width:720px;margin:0 auto;padding:24px;display:grid;gap:18px}
.card{background:#12161f;border:1px solid #2a2f3a;border-radius:14px;padding:16px}
.btn{background:#161b23;border:1px solid #323b46;color:#fff;border-radius:10px;padding:6px 12px;cursor:pointer;text-decoration:none;display:inline-block}
.btn.primary{background:#e76f51;border-color:#c15340}
input[type=text]{width:100%;padding:6px 9px;border-radius:8px;border:1px solid #273143;background:#0b0e14;color:#e5e7eb}
table{width:100%;border-collapse:collapse}
th,td{border-bottom:1px solid rgba(255,255,255,.03);padding:6px 4px;font-size:.9rem}
.preview{width:60px;height:60px;border-radius:50%;background:#14161a}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h1>Styles du vinyle</h1>
      <p>Cette page gère la <strong>liste unique</strong> utilisée par l’admin (upload + gestion). Chaque entrée doit correspondre à une classe CSS existante dans ton <code>css/style.css</code> (par exemple <code>.effect-neon</code>).</p>
      <p><a class="btn" href="index.php?view=manage">← Retour admin</a></p>
    </div>

    <?php if($msg): ?>
      <div class="card" style="background:rgba(0,255,161,.05);border-color:#00ffa1">
        <?php echo htmlspecialchars($msg); ?>
      </div>
    <?php endif; ?>

    <div class="card">
      <h2>Ajouter un style</h2>
      <form method="post">
        <input type="hidden" name="action" value="add">
        <label>ID (classe CSS, ex: <code>effect-holo</code>)
          <input type="text" name="id" required>
        </label>
        <label>Label (ce qui s’affiche dans l’admin)
          <input type="text" name="label" required>
        </label>
        <button class="btn primary" type="submit">Ajouter</button>
      </form>
    </div>

    <div class="card">
      <h2>Styles existants (<?php echo count($styles); ?>)</h2>
      <table>
        <tr>
          <th>ID (classe)</th>
          <th>Label</th>
          <th></th>
        </tr>
        <?php foreach($styles as $st): ?>
          <tr>
            <td><code><?php echo htmlspecialchars($st['id']); ?></code></td>
            <td>
              <form method="post" style="display:flex;gap:6px;align-items:center">
                <input type="hidden" name="action" value="update">
                <input type="hidden" name="id" value="<?php echo htmlspecialchars($st['id']); ?>">
                <input type="text" name="label" value="<?php echo htmlspecialchars($st['label']); ?>">
                <button class="btn" type="submit">💾</button>
              </form>
            </td>
            <td>
              <form method="post" onsubmit="return confirm('Supprimer ce style ? (attention: les vinyles qui l’utilisent garderont le nom, mais la classe pourra ne plus exister en CSS)')">
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?php echo htmlspecialchars($st['id']); ?>">
                <button class="btn" type="submit">🗑️</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </table>
    </div>
  </div>
</body>
</html>
