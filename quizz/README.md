# Quizz

Bienvenue sur le Hub de quiz de Sterenna, publié dans Gwen Ha Star sous `/quizz/`.

## Architecture
- `index.html` : La page d'accueil du Hub (Design System Sterenna). Elle liste dynamiquement tous les quiz disponibles.
- `data/quizzes.json` : Le fichier de configuration central. Ajoutez une entrée ici pour faire apparaître un nouveau quiz sur le Hub.
- `quizzes/` : Dossier contenant les quiz individuels.
  - `bzh-pw-lol/` : Le "Mega Quiz" BZH PW League of Legends, avec son propre design (HUD LoL) et son fichier `questions.json` contenant plus de 200 questions générées.

## Comment ajouter un quiz
1. Créez un dossier dans `quizzes/mon-nouveau-quiz/`
2. Placez-y un fichier `index.html` (avec son propre design/logique) et ses datas (`questions.json`).
3. Ajoutez l'entrée correspondante dans `data/quizzes.json`.

## Git Branches
- `main` : Branche de production.
- `dev` : Branche de développement pour les futurs quiz.
