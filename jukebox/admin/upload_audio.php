<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

$root       = dirname(__DIR__);
$audioDir   = $root . '/audio/';
$stylesFile = $root . '/vinyl_styles.json';

if(!is_dir($audioDir)) {
    mkdir($audioDir, 0775, true);
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
function read_styles($file){
    $raw = @file_get_contents($file);
    if(!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

if($_SERVER['REQUEST_METHOD'] !== 'POST'){
    header('Location: index.php?view=upload');
    exit;
}

if(!isset($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK){
    header('Location: index.php?view=upload&msg='.urlencode('Upload échoué.'));
    exit;
}

$file = $_FILES['audio'];
$ext  = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if(!in_array($ext, ['mp3','ogg','wav','m4a'])){
    header('Location: index.php?view=upload&msg='.urlencode('Format non supporté.'));
    exit;
}

$base     = slugify(pathinfo($file['name'], PATHINFO_FILENAME));
$destName = $base.'-'.substr(md5(uniqid('',true)),0,4).'.'.$ext;
$dest     = $audioDir.$destName;

if(!move_uploaded_file($file['tmp_name'], $dest)){
    header('Location: index.php?view=upload&msg='.urlencode('Impossible de déplacer le fichier.'));
    exit;
}

$meta   = parse_id3v1($dest);
$title  = $meta['title']  ?: ucfirst(str_replace('-', ' ', $base));
$artist = $meta['artist'] ?: 'Unknown';
$srcRel = 'audio/'.$destName;

$styles = read_styles($stylesFile);
if (empty($styles)) {
    $styles = [
        [ "id" => "effect-none", "label" => "Classique sombre" ]
    ];
}
?>
<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<title>Presser le vinyle</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
body{background:#0d0f12;color:#e5e7eb;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu}
.wrap{max-width:760px;margin:0 auto;padding:24px}
.card{background:#12161f;border:1px solid #2a2f3a;border-radius:14px;padding:16px}
label{display:block;margin:.45rem 0 .2rem}
input[type=text],input[type=color],input[type=number],select{width:100%;padding:7px 9px;border-radius:8px;border:1px solid #273143;background:#0b0e14;color:#e5e7eb}
.btn{background:#e76f51;border:1px solid #c15340;border-radius:10px;padding:7px 12px;color:#fff;cursor:pointer;text-decoration:none;display:inline-block}
.preview-vinyl{width:130px;height:130px;border-radius:50%;display:grid;place-items:center;margin-top:8px;background:#14161a}
.preview-vinyl .art{width:50px;height:50px;border-radius:50%;background:#999}
</style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <h2>Presser le vinyle</h2>
      <p>Audio téléversé : <strong><?php echo htmlspecialchars($destName); ?></strong></p>
      <audio controls src="../<?php echo htmlspecialchars($srcRel); ?>"></audio>
      <form method="post" action="index.php?view=manage" enctype="multipart/form-data">
        <input type="hidden" name="action" value="press">
        <input type="hidden" name="src" value="<?php echo htmlspecialchars($srcRel); ?>">

        <label>ID (optionnel)
          <input type="text" name="id" value="<?php echo htmlspecialchars($base); ?>">
        </label>
        <label>Titre
          <input type="text" name="title" value="<?php echo htmlspecialchars($title); ?>" required>
        </label>
        <label>Artiste
          <input type="text" name="artist" value="<?php echo htmlspecialchars($artist); ?>" required>
        </label>

        <label>Style du vinyle
          <select name="vinylStyle">
            <?php foreach($styles as $st): ?>
              <option value="<?php echo htmlspecialchars($st['id']); ?>">
                <?php echo htmlspecialchars($st['label']); ?> (<?php echo htmlspecialchars($st['id']); ?>)
              </option>
            <?php endforeach; ?>
          </select>
        </label>

        <div class="preview-vinyl"><div class="art"></div></div>

        <label>Couleur disque
          <input type="color" name="coverColor" value="#14161a">
        </label>
        <label>Couleur secondaire
          <input type="color" name="labelColor" value="#050608">
        </label>
        <label>Image de cover
          <input type="file" name="coverImage" accept=".jpg,.jpeg,.png,.webp">
        </label>

        <label>Lien externe
          <input type="text" name="externalUrl" placeholder="https://...">
        </label>
        <label>Tags
          <input type="text" name="tags" placeholder="bzh, electro, lounge">
        </label>
        <label>BPM
          <input type="number" name="bpm" value="0">
        </label>
        <label>Durée
          <input type="text" name="duration" placeholder="03:42">
        </label>
        <label style="display:flex;gap:6px;align-items:center">
          <input type="checkbox" name="display" checked>
          Visible
        </label>

        <button class="btn" type="submit">Presser le vinyle ✅</button>
        <a class="btn" href="index.php?view=manage">Annuler</a>
      </form>
    </div>
  </div>
</body>
</html>
