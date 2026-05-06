<?php
// Sterenna Jukebox Admin v6 – version "style unique"
error_reporting(E_ALL);
ini_set('display_errors', 0);

$root       = dirname(__DIR__);
$jsonFile   = $root . '/records.json';
$audioDir   = $root . '/audio/';
$imgDir     = $root . '/img/';
$stylesFile = $root . '/vinyl_styles.json';

if (!file_exists($jsonFile)) {
    file_put_contents($jsonFile, "[]");
}
if (!is_dir($audioDir)) {
    mkdir($audioDir, 0775, true);
}
if (!is_dir($imgDir)) {
    mkdir($imgDir, 0775, true);
}
if (!file_exists($stylesFile)) {
    // défaut
    file_put_contents($stylesFile, json_encode([
        [ "id" => "effect-none",    "label" => "Classique sombre" ],
        [ "id" => "effect-calc",    "label" => "Calculs / Tech" ],
        [ "id" => "effect-bicolor", "label" => "Bicolore" ],
        [ "id" => "effect-water",   "label" => "Eau animée" ],
        [ "id" => "effect-grid",    "label" => "Grille data" ],
        [ "id" => "effect-metal",   "label" => "Métal steampunk" ],
        [ "id" => "effect-neon",    "label" => "Néon BZH" ],
        [ "id" => "effect-logo",    "label" => "Logo BZH (css/bzh_logo.png)" ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

// --- helpers ---
function read_records($file){
    $raw = @file_get_contents($file);
    if(!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function write_records($file, $records){
    $fp = fopen($file,'c+');
    flock($fp, LOCK_EX);
    ftruncate($fp,0);
    fwrite($fp, json_encode($records, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
}
function read_styles($file){
    $raw = @file_get_contents($file);
    if(!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
function slugify($str){
    $str = strtolower(trim($str));
    $str = preg_replace('/[^a-z0-9]+/','-', $str);
    $str = preg_replace('/-+/','-', $str);
    return trim($str, '-');
}
function parse_id3v1($file){
    $res = ['title'=>'','artist'=>''];
    if(!is_file($file)) return $res;
    $fp = fopen($file, 'rb');
    if(!$fp) return $res;
    fseek($fp, -128, SEEK_END);
    $tag = fread($fp, 128);
    fclose($fp);
    if(substr($tag,0,3)==='TAG'){
        $res['title']  = trim(substr($tag, 3, 30));
        $res['artist'] = trim(substr($tag, 33, 30));
    }
    return $res;
}
function scan_audio($dir){
    $list = [];
    foreach(scandir($dir) as $f){
        if($f==='.'||$f==='..') continue;
        $p = $dir.$f;
        if(is_file($p)){
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if(in_array($ext, ['mp3','ogg','wav','m4a'])) {
                $list[] = $f;
            }
        }
    }
    sort($list);
    return $list;
}

$view       = $_GET['view']   ?? '';
$action     = $_POST['action'] ?? '';
$records    = read_records($jsonFile);
$audioFiles = scan_audio($audioDir);
$styles     = read_styles($stylesFile);

// === POST actions ===
if($_SERVER['REQUEST_METHOD']==='POST'){

    // create / update record
    if($action === 'press' || $action === 'update'){
        $id     = $_POST['id']     ?? '';
        $title  = trim($_POST['title']  ?? '');
        $artist = trim($_POST['artist'] ?? '');
        $src    = trim($_POST['src']    ?? '');
        $display= isset($_POST['display']);
        $coverColor = trim($_POST['coverColor'] ?? '#14161a');
        $labelColor = trim($_POST['labelColor'] ?? '#050608');
        // UNE SEULE LISTE MAINTENANT
        $vinylStyle  = $_POST['vinylStyle'] ?? 'effect-none';

        $externalUrl = trim($_POST['externalUrl'] ?? '');
        $tags = array_values(array_filter(array_map('trim', explode(',', $_POST['tags'] ?? ''))));
        $bpm = intval($_POST['bpm'] ?? 0);
        $duration = trim($_POST['duration'] ?? '');

        if($title === '' || $artist === '' || $src === ''){
            header('Location: index.php?view=upload&msg='.urlencode('Titre, artiste, source requis.'));
            exit;
        }

        // handle cover upload
        $coverImage = '';
        if(isset($_FILES['coverImage']) && $_FILES['coverImage']['error'] === UPLOAD_ERR_OK){
            $ext = strtolower(pathinfo($_FILES['coverImage']['name'], PATHINFO_EXTENSION));
            if(in_array($ext, ['jpg','jpeg','png','webp'])){
                $fname = ($id ?: slugify($title)).'-'.substr(md5(uniqid('',true)),0,5).'.'.$ext;
                if(move_uploaded_file($_FILES['coverImage']['tmp_name'], $imgDir.$fname)){
                    $coverImage = 'img/'.$fname;
                }
            }
        }

        if($id === '') $id = slugify($title);

        $found = -1;
        foreach($records as $i=>$r){
            if(($r['id'] ?? '') === $id){
                $found = $i; break;
            }
        }

        $entry = $found>=0 ? $records[$found] : ['id'=>$id];
        $entry['title']       = $title;
        $entry['artist']      = $artist;
        $entry['src']         = $src;
        $entry['display']     = $display;
        $entry['coverColor']  = $coverColor;
        $entry['labelColor']  = $labelColor;
        $entry['vinylStyle']  = $vinylStyle;   // 👈 nouveau champ unique
        $entry['externalUrl'] = $externalUrl;
        $entry['tags']        = $tags;
        $entry['bpm']         = $bpm;
        $entry['duration']    = $duration;
        if($coverImage !== '') {
            $entry['coverImage'] = $coverImage;
        }

        if($found>=0) $records[$found] = $entry;
        else array_unshift($records, $entry);

        write_records($jsonFile, $records);
        header('Location: index.php?view=manage&msg='.urlencode('Enregistré.'));
        exit;
    }

    // delete record
    if($action === 'delete'){
        $id = $_POST['id'] ?? '';
        $records = array_values(array_filter($records, fn($r)=> ($r['id'] ?? '') !== $id));
        write_records($jsonFile, $records);
        header('Location: index.php?view=manage&msg='.urlencode('Supprimé.'));
        exit;
    }

    // scan audio/ to auto-add
    if($action === 'scan'){
        $existing = array_map(fn($r)=>$r['src'] ?? '', $records);
        $added = 0;
        foreach($audioFiles as $file){
            $rel = 'audio/'.$file;
            if(!in_array($rel, $existing, true)){
                $meta = parse_id3v1($audioDir.$file);
                $title  = $meta['title']  ?: pathinfo($file, PATHINFO_FILENAME);
                $artist = $meta['artist'] ?: 'Unknown';
                $records[] = [
                    'id'          => slugify($title),
                    'title'       => $title,
                    'artist'      => $artist,
                    'src'         => $rel,
                    'display'     => false,
                    'coverColor'  => '#14161a',
                    'labelColor'  => '#050608',
                    'vinylStyle'  => 'effect-none',
                    'externalUrl' => '',
                    'tags'        => [],
                    'bpm'         => 0,
                    'duration'    => ''
                ];
                $added++;
            }
        }
        write_records($jsonFile, $records);
        header('Location: index.php?view=manage&msg='.urlencode("Scan terminé. Ajoutés: $added"));
        exit;
    }
}

$msg = $_GET['msg'] ?? '';
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Admin Jukebox v6</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{margin:0;background:#0d0f12;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu}
.wrap{max-width:1080px;margin:0 auto;padding:24px;display:grid;gap:18px}
.hero{display:flex;justify-content:space-between;gap:12px;align-items:center}
.btn{background:#161b23;border:1px solid #323b46;color:#fff;border-radius:10px;padding:8px 12px;cursor:pointer;text-decoration:none;display:inline-block}
.btn.primary{background:#e76f51;border-color:#c15340}
.card{background:#12161f;border:1px solid #2a2f3a;border-radius:14px;padding:16px}
label{display:block;margin:.45rem 0 .2rem}
input[type=text],input[type=color],input[type=number],select{width:100%;padding:7px 9px;border-radius:8px;border:1px solid #273143;background:#0b0e14;color:#e5e7eb}
details{background:#0f131b;border:1px solid #2a2f3a;border-radius:10px;padding:10px;margin-bottom:10px}
summary{cursor:pointer;font-weight:600}
.preview-vinyl{width:120px;height:120px;border-radius:50%;display:grid;place-items:center;margin-top:8px;background:#14161a}
.preview-vinyl .art{width:46px;height:46px;border-radius:50%;background:#999}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:820px){.grid2{grid-template-columns:1fr}}
</style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div>
        <h1>Admin Jukebox v6</h1>
        <p>Upload, gestion des vinyles, et <strong>styles uniques</strong>.</p>
      </div>
      <div>
        <a class="btn primary" href="index.php?view=upload">📀 Upload</a>
        <a class="btn" href="index.php?view=manage">📚 Gestion</a>
        <a class="btn" href="styles.php">🎨 Styles vinyle</a>
        <a class="btn" href="../" target="_blank">↗ Voir le jukebox</a>
      </div>
    </div>

    <?php if($msg): ?>
      <div class="card" style="background:rgba(0,255,161,.05);border-color:#00ffa1">
        <?php echo htmlspecialchars($msg); ?>
      </div>
    <?php endif; ?>

    <?php if($view === 'upload'): ?>
      <div class="card">
        <h2>Uploader un audio</h2>
        <p>Étape 1 : tu envoies le fichier audio. Étape 2 : tu choisis le <strong>style du vinyle</strong>.</p>
        <form method="post" enctype="multipart/form-data" action="upload_audio.php">
          <label>Fichier audio
            <input type="file" name="audio" accept=".mp3,.ogg,.wav,.m4a" required>
          </label>
          <button class="btn primary" type="submit">Téléverser</button>
        </form>
      </div>
      <div class="card">
        <h2>Fichiers présents dans /audio</h2>
        <ul>
        <?php foreach($audioFiles as $f): ?>
          <li><?php echo htmlspecialchars($f); ?></li>
        <?php endforeach; ?>
        </ul>
      </div>

    <?php elseif($view === 'manage'): ?>
      <div class="card">
        <form method="post">
          <input type="hidden" name="action" value="scan">
          <button class="btn" type="submit">🔍 Scanner /audio</button>
        </form>
      </div>

      <div class="card">
        <h2>Catalogue (<?php echo count($records); ?>)</h2>
        <?php foreach($records as $r): $id = htmlspecialchars($r['id'] ?? ''); ?>
          <details>
            <summary>
              <?php echo htmlspecialchars($r['title'] ?? '(sans titre)'); ?>
              — <span style="opacity:.6"><?php echo htmlspecialchars($r['artist'] ?? 'Unknown'); ?></span>
              <?php if(!empty($r['display'])) echo ' • visible'; ?>
            </summary>
            <form method="post" enctype="multipart/form-data" class="grid2" style="margin-top:10px">
              <input type="hidden" name="action" value="update">
              <input type="hidden" name="id" value="<?php echo $id; ?>">

              <label>Titre
                <input type="text" name="title" value="<?php echo htmlspecialchars($r['title'] ?? ''); ?>">
              </label>
              <label>Artiste
                <input type="text" name="artist" value="<?php echo htmlspecialchars($r['artist'] ?? ''); ?>">
              </label>
              <label>Source audio
                <input type="text" name="src" value="<?php echo htmlspecialchars($r['src'] ?? ''); ?>">
              </label>
              <label>Cover image
                <input type="file" name="coverImage" accept=".jpg,.jpeg,.png,.webp">
              </label>
              <label>Couleur disque
                <input type="color" name="coverColor" value="<?php echo htmlspecialchars($r['coverColor'] ?? '#14161a'); ?>">
              </label>
              <label>Couleur secondaire
                <input type="color" name="labelColor" value="<?php echo htmlspecialchars($r['labelColor'] ?? '#050608'); ?>">
              </label>

              <label>Style du vinyle
                <select name="vinylStyle">
                  <?php
                  $currentStyle = $r['vinylStyle'] ?? 'effect-none';
                  foreach($styles as $st):
                    $sid = $st['id']; $slab = $st['label'];
                  ?>
                    <option value="<?php echo htmlspecialchars($sid); ?>" <?php if($sid === $currentStyle) echo 'selected'; ?>>
                      <?php echo htmlspecialchars($slab); ?> (<?php echo $sid; ?>)
                    </option>
                  <?php endforeach; ?>
                </select>
              </label>

              <div>
                <div>Preview (théorique)</div>
                <div class="preview-vinyl <?php echo htmlspecialchars($r['vinylStyle'] ?? 'effect-none'); ?>">
                    <div class="art"></div>
                </div>
              </div>

              <label>Lien externe
                <input type="text" name="externalUrl" value="<?php echo htmlspecialchars($r['externalUrl'] ?? ''); ?>" placeholder="https://...">
              </label>
              <label>Tags (séparés par des virgules)
                <input type="text" name="tags" value="<?php echo htmlspecialchars(implode(',', $r['tags'] ?? [])); ?>">
              </label>
              <label>BPM
                <input type="number" name="bpm" value="<?php echo intval($r['bpm'] ?? 0); ?>">
              </label>
              <label>Durée
                <input type="text" name="duration" value="<?php echo htmlspecialchars($r['duration'] ?? ''); ?>" placeholder="03:42">
              </label>
              <label style="display:flex;gap:6px;align-items:center">
                <input type="checkbox" name="display" <?php if(!empty($r['display'])) echo 'checked'; ?>>
                Visible sur le jukebox
              </label>

              <div>
                <button class="btn primary" type="submit">💾 Enregistrer</button>
              </div>
            </form>

            <form method="post" onsubmit="return confirm('Supprimer ce disque ?')" style="margin-top:6px">
              <input type="hidden" name="action" value="delete">
              <input type="hidden" name="id" value="<?php echo $id; ?>">
              <button class="btn" type="submit">🗑️ Supprimer</button>
            </form>
          </details>
        <?php endforeach; ?>
      </div>

    <?php else: ?>
      <div class="card">
        <p>Bienvenue dans l’admin du jukebox.</p>
        <p>Choisis : “Upload” pour envoyer un nouvel audio, “Gestion” pour éditer les vinyles, ou “Styles vinyle” pour gérer la liste des styles utilisables dans le front.</p>
      </div>
    <?php endif; ?>
  </div>
</body>
</html>
