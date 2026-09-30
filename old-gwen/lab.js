import { supabase } from './shared/supabaseClient.js';
import { spendGold, getGold, refreshGold } from './shared/economy.js';

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
}

// Variables globales
let currentUser = null;
let currentUserProfile = null;
let leaderboardData = [];
let isLeaderboardCollapsed = false;
let currentSortMode = 'gold'; // 'gold' ou 'cards'

// Variables pour le mystérieux voyageur
let mysteryClickCount = 0;
let lastClickTime = 0;
let mysteryUnlocked = false;
let translatorBought = false;

// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Vérification de l'utilisateur connecté
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            currentUser = session.user;
            await loadCurrentUserProfile();
            await initializePlayerCache(); // AJOUTÉ : Initialiser le cache
            await loadLeaderboard();
            updateUserStatus();
        }

        setupEventListeners();
    } catch (error) {
        console.error('Erreur d\'initialisation:', error);
    }
});

// CORRECTION DÉFINITIVE : initializePlayerCache()
async function initializePlayerCache() {
    if (!currentUser || !currentUserProfile) {
        console.log('❌ Pas d\'utilisateur ou de profil pour initialiser le cache');
        return;
    }

    console.log('🔄 Initialisation du cache joueur...');

    try {
        // PROBLÈME RÉSOLU : Au lieu d'updateCachedPlayer(), utiliser initPlayer()
        // qui va soit charger le cache existant, soit créer/charger depuis la DB
        const { initPlayer } = await import('./shared/supabaseData.js');

        // Ceci va initialiser _player dans supabaseData.js
        const player = await initPlayer();

        if (player) {
            console.log('✅ Cache joueur initialisé via initPlayer:', player.id);
        } else {
            console.log('❌ Échec initialisation cache joueur');
        }

        return player;
    } catch (error) {
        console.error('❌ Erreur initialisation cache:', error);
        throw error;
    }
}

// Chargement du profil utilisateur actuel
async function loadCurrentUserProfile() {
    if (!currentUser) return;

    try {
        // Récupérer le profil + les stats depuis la table players
        const { data: playerData } = await supabase
            .from('players')
            .select('username, gold, pack_count, cards_qty')
            .eq('id', currentUser.id)
            .single();

        // Récupérer la bio depuis profiles
        const { data: profileData } = await supabase
            .from('profiles')
            .select('bio, avatar_url')
            .eq('id', currentUser.id)
            .single();

        currentUserProfile = {
            ...playerData,
            bio: profileData?.bio || 'Explorateur des néo-données...'
        };

    } catch (error) {
        console.error('Erreur chargement profil:', error);
        currentUserProfile = {
            username: 'Joueur Anonyme',
            bio: 'Explorateur des néo-données...',
            gold: 0,
            pack_count: 0,
            cards_qty: 0
        };
    }
}

// Mise à jour du statut utilisateur - PSEUDO CLIQUABLE
function updateUserStatus() {
    const userStatus = document.getElementById('user-status');
    const authBtn = document.getElementById('auth-btn');

    if (currentUser && currentUserProfile) {
        // PSEUDO CLIQUABLE pour ouvrir la CIG (plus d'email !)
        const profileLink = document.createElement('button');
        profileLink.type = 'button';
        profileLink.textContent = `👤 ${currentUserProfile.username || 'Joueur'}`;
        profileLink.addEventListener('click', () => showCIG(currentUser.id));
        userStatus.replaceChildren(profileLink);
        authBtn.textContent = 'Déconnexion';
        authBtn.onclick = logout;
    } else {
        userStatus.textContent = 'Non connecté';
        authBtn.textContent = 'Connexion';
        authBtn.onclick = () => window.location.href = 'login.html';
    }
}

// === GESTION CIG FACE UNIQUE SIMPLIFIÉE ===
async function showCIG(playerId) {
    console.log('Ouverture CIG pour joueur:', playerId);

    let profile;
    let playerRank = '-';

    if (playerId === currentUser?.id) {
        profile = currentUserProfile;
        // Calculer le rang du joueur actuel
        playerRank = calculatePlayerRank(playerId);
    } else {
        try {
            const { data: playerData } = await supabase
                .from('players')
                .select('username, gold, pack_count, cards_qty')
                .eq('id', playerId)
                .single();

            const { data: profileData } = await supabase
                .from('profiles')
                .select('bio, avatar_url')
                .eq('id', playerId)
                .single();

            profile = {
                ...playerData,
                bio: profileData?.bio || 'Mystérieux joueur...'
            };

            playerRank = calculatePlayerRank(playerId);
        } catch (error) {
            console.error('Erreur chargement profil joueur:', error);
            return;
        }
    }

    if (!profile) return;

    // Remplir TOUTES les données de la CIG sur la face unique
    document.getElementById('cig-username').textContent = profile.username || 'Joueur Anonyme';
    document.getElementById('cig-bio').textContent = profile.bio || 'Mystérieux joueur...';
    document.getElementById('cig-gold').textContent = (profile.gold || 0).toLocaleString();
    document.getElementById('cig-packs').textContent = (profile.pack_count || 0).toLocaleString();
    document.getElementById('cig-cards').textContent = (profile.cards_qty || 0).toLocaleString();
    document.getElementById('cig-rank').textContent = playerRank;

    // BOUTON CRAYON visible seulement pour le joueur actuel
    const editBtn = document.getElementById('edit-profile-btn');
    if (playerId === currentUser?.id) {
        editBtn.style.display = 'flex';
        editBtn.onclick = () => window.location.href = 'modification_profil.html';
    } else {
        editBtn.style.display = 'none';
    }

    // MASQUER le contenu principal et AFFICHER la CIG
    const mainContent = document.getElementById('main-content');
    const cigContainer = document.getElementById('cig-container');

    mainContent.classList.add('hidden-for-cig');
    cigContainer.style.display = 'flex';

    console.log('CIG ouverte avec toutes les infos sur une seule face');
}

function closeCIG() {
    console.log('Fermeture CIG');

    // RÉAFFICHER le contenu principal et MASQUER la CIG
    const mainContent = document.getElementById('main-content');
    const cigContainer = document.getElementById('cig-container');

    cigContainer.style.display = 'none';
    mainContent.classList.remove('hidden-for-cig');
}

// Fonction utilitaire pour calculer le rang d'un joueur
function calculatePlayerRank(playerId) {
    if (!leaderboardData || leaderboardData.length === 0) return '-';

    // Trouver la position du joueur dans le leaderboard
    const playerIndex = leaderboardData.findIndex(player => player.id === playerId);

    if (playerIndex === -1) return '-';

    const rank = playerIndex + 1;

    // Ajouter des médailles pour le top 3
    if (rank === 1) return '🥇 #1';
    if (rank === 2) return '🥈 #2';
    if (rank === 3) return '🥉 #3';

    return '#' + rank;
}

// === MYSTÉRIEUX VOYAGEUR ===
function handleMysteryClick() {
    const currentTime = Date.now();

    // Reset si plus de 5 secondes entre les clics
    if (currentTime - lastClickTime > 5000) {
        mysteryClickCount = 0;
        document.body.className = '';
        document.getElementById('mystery-card').classList.remove('activated');
    }

    lastClickTime = currentTime;
    mysteryClickCount++;

    // Mise à jour du compteur
    const counter = document.getElementById('click-counter');
    const countDisplay = document.getElementById('click-count');
    counter.style.display = 'block';
    countDisplay.textContent = mysteryClickCount;

    // Effets progressifs d'alarme
    if (mysteryClickCount <= 5) {
        document.body.className = 'alarm-level-' + mysteryClickCount;
        document.getElementById('mystery-card').classList.add('activated');
    } else if (mysteryClickCount <= 9) {
        const alarmLevel = Math.min(5, mysteryClickCount - 4);
        document.body.className = 'alarm-level-' + alarmLevel;
    }

    // Au 10ème clic, apparition du voyageur
    if (mysteryClickCount >= 10) {
        showMysteriousTraveler();
    }
}

function showMysteriousTraveler() {
    // MASQUER le contenu principal pour le voyageur aussi
    const mainContent = document.getElementById('main-content');
    const modal = document.getElementById('traveler-modal');

    mainContent.classList.add('hidden-for-cig');
    modal.style.display = 'flex';

    if (!translatorBought) {
        showKoreanDialogue();
    } else {
        showTranslatedDialogue();
    }
}

function showKoreanDialogue() {
    const dialogue = document.getElementById('traveler-dialogue');
    const actions = document.getElementById('traveler-actions');

    dialogue.innerHTML = '<p style="font-style: italic; color: #ffd700;">안녕하세요, 제 이름은 천여운입니다. 여기서 길을 잃었는데, 집에 돌아갈 돈이 없어요...</p><p style="color: #ccc; font-size: 0.9em;">Vous ne comprenez pas ce que dit cet étrange homme équipé d\'une magnifique épée...</p>';

    const userGold = currentUserProfile?.gold || 0;

    if (userGold >= 100) {
        actions.innerHTML = '<button class="traveler-btn" onclick="buyTranslator()">🌐 Acheter un traducteur (100 Gold)</button><button class="traveler-btn danger" onclick="ignoreTraveler()">🏃 Ignorer et fuir</button>';
    } else {
        actions.innerHTML = '<button class="traveler-btn" disabled style="opacity: 0.5;">🌐 Traducteur (100 Gold) - Insuffisant</button><button class="traveler-btn danger" onclick="ignoreTraveler()">🏃 Ignorer et fuir</button>';
    }
}

// CORRIGÉ DÉFINITIVEMENT : Utilisation correcte d'economy.js
async function buyTranslator() {
    try {
        console.log('🛒 Tentative d\'achat du traducteur...');

        // 1. Vérifier que l'utilisateur est connecté
        if (!currentUser) {
            alert('Utilisateur non connecté');
            return;
        }

        console.log('✅ Utilisateur connecté:', currentUser.id);

        // 2. CRITIQUE : Initialiser le cache joueur CORRECTEMENT
        const player = await initializePlayerCache();
        if (!player) {
            alert('Erreur d\'initialisation du joueur');
            return;
        }

        console.log('✅ Cache initialisé:', player);

        // 3. Vérifier le solde avec economy.js
        const currentGold = await getGold();
        console.log('💰 Gold actuel:', currentGold);

        if (currentGold < 100) {
            alert('Gold insuffisant pour acheter le traducteur');
            return;
        }

        // 4. Dépenser 100 gold avec economy.js
        const newGold = await spendGold(100);
        console.log('💸 Nouvel or après achat:', newGold);

        // 5. Mettre à jour le profil local
        currentUserProfile.gold = newGold;
        translatorBought = true;

        console.log('✅ Traducteur acheté ! Nouveau solde:', newGold);
        showTranslatedDialogue();

    } catch (error) {
        console.error('❌ Erreur achat traducteur:', error);
        alert('Erreur lors de l\'achat du traducteur: ' + error.message);
    }
}

function showTranslatedDialogue() {
    const dialogue = document.getElementById('traveler-dialogue');
    const actions = document.getElementById('traveler-actions');

    dialogue.innerHTML = '<p style="color: #ffd700;">"Bonjour, je m\'appelle Cheon Yeo Woon. Je me suis perdu ici après avoir traversé une faille dimensionnelle. Je ne possède pas la monnaie de votre monde pour rentrer chez moi..."</p><p style="color: #ff8c00;">"Pourriez-vous m\'aider à payer le voyage vers ma dimension ? J\'ai besoin de 1000 pièces d\'or de votre monde."</p>';

    actions.innerHTML = '<button class="traveler-btn" onclick="considerHelp()">👂 Écouter sa requête</button><button class="traveler-btn danger" onclick="fleeFromTraveler()">🏃 Fuir très loin</button>';
}

function considerHelp() {
    const dialogue = document.getElementById('traveler-dialogue');
    const actions = document.getElementById('traveler-actions');
    const userGold = currentUserProfile?.gold || 0;

    dialogue.innerHTML = '<p style="color: #ffd700;">"J\'ai besoin de 1000 pièces d\'or pour alimenter le portail dimensionnel qui me ramènera dans mon monde de cultivation martiale."</p><p style="color: #ff8c00;">"En échange, je pourrais vous révéler un secret de ce laboratoire..."</p><p style="color: #ccc;">Votre gold actuel: <strong>' + userGold + ' 🪙</strong></p>';

    if (userGold >= 1000) {
        actions.innerHTML = '<button class="traveler-btn" onclick="helpTraveler()">✨ Aider (1000 Gold)</button><button class="traveler-btn danger" onclick="refuseTraveler()">❌ Refuser</button>';
    } else {
        actions.innerHTML = '<button class="traveler-btn" disabled style="opacity: 0.5;">✨ Aider (1000 Gold) - Insuffisant</button><button class="traveler-btn danger" onclick="refuseTraveler()">❌ Refuser</button>';
    }
}

// CORRIGÉ DÉFINITIVEMENT : Utilisation correcte d'economy.js
async function helpTraveler() {
    try {
        console.log('🤝 Tentative d\'aide au voyageur...');

        // 1. Vérifier que l'utilisateur est connecté
        if (!currentUser) {
            alert('Utilisateur non connecté');
            return;
        }

        // 2. CRITIQUE : Initialiser le cache joueur CORRECTEMENT
        const player = await initializePlayerCache();
        if (!player) {
            alert('Erreur d\'initialisation du joueur');
            return;
        }

        // 3. Vérifier le solde avec economy.js
        const currentGold = await getGold();
        console.log('💰 Gold actuel:', currentGold);

        if (currentGold < 1000) {
            const dialogue = document.getElementById('traveler-dialogue');
            dialogue.innerHTML = '<p style="color: #ff8c00;">"Cela n\'est pas suffisant... Il va falloir trouver un moyen de faire plus d\'or."</p><p style="color: #ffd700;">"Je vais réfléchir en méditant dans le coin en attendant."</p>';

            setTimeout(resetMysteryState, 3000);
            return;
        }

        // 4. Dépenser 1000 gold avec economy.js
        const newGold = await spendGold(1000);
        console.log('💸 Nouvel or après aide:', newGold);

        // 5. Mettre à jour le profil local
        currentUserProfile.gold = newGold;

        console.log('✅ Voyageur aidé ! Nouveau solde:', newGold);

        // Animation de remerciement et révélation du secret
        const dialogue = document.getElementById('traveler-dialogue');
        dialogue.innerHTML = '<p style="color: #ffd700;">"Merci infiniment ! Grâce à votre générosité, je peux rentrer chez moi."</p><p style="color: #ff8c00;">"En remerciement, laissez-moi vous révéler ce secret..."</p>';

        setTimeout(() => {
            performSwordSlash();
        }, 2000);

    } catch (error) {
        console.error('❌ Erreur aide voyageur:', error);
        alert('Erreur lors du paiement: ' + error.message);
    }
}

function performSwordSlash() {
    const dialogue = document.getElementById('traveler-dialogue');
    dialogue.innerHTML = '<p style="color: #ffd700; animation: swordGlow 1s ease-in-out;">"Technique de l\'Épée Céleste : Fente Dimensionnelle !"</p><div style="font-size: 2em; text-align: center; animation: swordSlash 2s ease-out;">⚡⚔️⚡</div>';

    // Ajouter les animations CSS temporaires
    const style = document.createElement('style');
    style.innerHTML = '@keyframes swordSlash { 0% { transform: scale(1) rotate(0deg); opacity: 1; } 50% { transform: scale(2) rotate(180deg); opacity: 0.8; } 100% { transform: scale(3) rotate(360deg); opacity: 0; } }';
    document.head.appendChild(style);

    setTimeout(() => {
        unlockMysteryProject();
        document.head.removeChild(style);
    }, 2000);
}

function unlockMysteryProject() {
    // Fermer le modal voyageur
    document.getElementById('traveler-modal').style.display = 'none';

    // Animation de désintégration du cache
    const overlay = document.querySelector('.mystery-overlay');
    overlay.classList.add('unlocking');

    setTimeout(() => {
        // Révéler le vrai projet
        const mysteryCard = document.getElementById('mystery-card');
        const title = document.getElementById('mystery-title');
        const description = document.getElementById('mystery-description');

        mysteryCard.classList.remove('locked', 'mystery');
        mysteryCard.classList.add('unlocked-project');

        overlay.style.display = 'none';

        title.innerHTML = 'Project Simulation';
        description.innerHTML = '<strong>Wuxia</strong> fusion fantasy and Sci-Fi<br><em style="color: #ffd700;">Débloqué par la générosité</em>';

        // Ajouter un lien vers le projet
        mysteryCard.onclick = () => {
            alert('🚧 Project Simulation en développement\n\nUn monde où la cultivation martiale rencontre la technologie cyberpunk !');
        };

        mysteryUnlocked = true;
    }, 2000);

    resetMysteryState();
}

function refuseTraveler() {
    const dialogue = document.getElementById('traveler-dialogue');
    dialogue.innerHTML = '<p style="color: #ff8c00;">"Je comprends... Chacun a ses priorités."</p><p style="color: #ffd700;">"Je vais rester méditer dans le coin en attendant qu\'une âme généreuse m\'aide."</p>';

    setTimeout(resetMysteryState, 3000);
}

function ignoreTraveler() {
    const dialogue = document.getElementById('traveler-dialogue');
    dialogue.innerHTML = '<p style="color: #ccc; font-style: italic;">Vous ne comprenez pas ce que souhaite cet étrange homme. Déçu, il semble s\'asseoir pour méditer...</p>';

    setTimeout(resetMysteryState, 3000);
}

function fleeFromTraveler() {
    resetMysteryState();
}

function resetMysteryState() {
    // RÉAFFICHER le contenu principal quand on ferme le voyageur
    const mainContent = document.getElementById('main-content');
    const modal = document.getElementById('traveler-modal');

    modal.style.display = 'none';
    mainContent.classList.remove('hidden-for-cig');

    document.body.className = '';
    document.getElementById('mystery-card').classList.remove('activated');
    document.getElementById('click-counter').style.display = 'none';
    mysteryClickCount = 0;
    lastClickTime = 0;
}

// Configuration des écouteurs d'événements - SIMPLIFIÉE (plus de flèches)
function setupEventListeners() {
    const refreshBtn = document.getElementById('refresh-leaderboard');
    const collapseBtn = document.getElementById('collapse-leaderboard');
    const goldSortBtn = document.getElementById('sort-gold');
    const cardsSortBtn = document.getElementById('sort-cards');
    const closeCigBtn = document.getElementById('close-cig');
    const mysteryCard = document.getElementById('mystery-card');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshLeaderboard);
    }

    if (collapseBtn) {
        collapseBtn.addEventListener('click', toggleLeaderboard);
    }

    if (goldSortBtn) {
        goldSortBtn.addEventListener('click', () => changeSortMode('gold'));
    }

    if (cardsSortBtn) {
        cardsSortBtn.addEventListener('click', () => changeSortMode('cards'));
    }

    if (closeCigBtn) {
        closeCigBtn.addEventListener('click', closeCIG);
    }

    if (mysteryCard) {
        mysteryCard.addEventListener('click', (e) => {
            e.preventDefault();
            if (!mysteryUnlocked) {
                handleMysteryClick();
            }
        });
    }

    console.log('✅ Écouteurs d\'événements configurés (CIG face unique)');
}

// Reste du code identique (fonctions du leaderboard etc.)
function changeSortMode(mode) {
    currentSortMode = mode;
    const goldBtn = document.getElementById('sort-gold');
    const cardsBtn = document.getElementById('sort-cards');
    const valueHeader = document.getElementById('value-header');

    if (goldBtn && cardsBtn) {
        goldBtn.classList.toggle('active', mode === 'gold');
        cardsBtn.classList.toggle('active', mode === 'cards');
        valueHeader.textContent = mode === 'gold' ? 'Gold' : 'Cartes';
    }

    loadLeaderboard();
}

function toggleLeaderboard() {
    const container = document.querySelector('.leaderboard-container');
    const collapseBtn = document.getElementById('collapse-leaderboard');

    if (!container || !collapseBtn) return;

    isLeaderboardCollapsed = !isLeaderboardCollapsed;

    if (isLeaderboardCollapsed) {
        container.classList.add('collapsed');
        collapseBtn.textContent = '🔽 Agrandir';
    } else {
        container.classList.remove('collapsed');
        collapseBtn.textContent = '🔼 Réduire';
    }
}

async function loadLeaderboard() {
    try {
        const leaderboardList = document.getElementById('leaderboard-list');
        if (!leaderboardList) return;

        leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem;">Chargement...</div>';

        const orderColumn = currentSortMode === 'gold' ? 'gold' : 'cards_qty';

        const { data, error } = await supabase
            .from('players')
            .select('id, username, gold, cards_qty')
            .order(orderColumn, { ascending: false })
            .limit(20);

        if (error) throw error;

        leaderboardData = data || [];
        renderLeaderboard();

    } catch (error) {
        console.error('Erreur lors du chargement du leaderboard:', error);
        const leaderboardList = document.getElementById('leaderboard-list');
        if (leaderboardList) {
            leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem; color: #f00;">Erreur: ' + escapeHtml(error.message) + '</div>';
        }
    }
}

function renderLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    if (!leaderboardList || !leaderboardData.length) {
        leaderboardList.innerHTML = '<div style="text-align: center; padding: 2rem;">Aucun joueur trouvé</div>';
        return;
    }

    const html = leaderboardData.map((player, index) => {
        const rank = index + 1;
        const isCurrentUser = currentUser && player.id === currentUser.id;
        const username = escapeHtml(player.username || 'Joueur Anonyme');
        const gold = player.gold || 0;
        const cardsCount = player.cards_qty || 0;

        let rankClass = '';
        let rankIcon = '';
        if (rank === 1) {
            rankClass = 'first';
            rankIcon = '🥇';
        } else if (rank === 2) {
            rankClass = 'second';
            rankIcon = '🥈';
        } else if (rank === 3) {
            rankClass = 'third';
            rankIcon = '🥉';
        }

        const displayValue = currentSortMode === 'gold'
            ? gold.toLocaleString() + ' 🪙'
            : cardsCount.toLocaleString() + ' 📇';

        return '<div class="leaderboard-item ' + (isCurrentUser ? 'current-user' : '') + '" onclick="showCIG(\''+escapeHtml(player.id)+'\')" data-player-id="'+escapeHtml(player.id)+'"><div class="rank '+rankClass+'">'+(rankIcon || '#'+rank)+(isCurrentUser ? '<div class="current-indicator">●</div>' : '')+'</div><div class="username">'+username+(isCurrentUser ? ' (Vous)' : '')+'</div><div class="value">'+escapeHtml(displayValue)+'</div></div>';
    }).join('');

    leaderboardList.innerHTML = html;
}

// CORRIGÉ : Actualisation avec economy.js
async function refreshLeaderboard() {
    const refreshBtn = document.getElementById('refresh-leaderboard');
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '🔄 Chargement...';
    }

    try {
        // Actualiser le gold avec economy.js
        if (currentUser && currentUserProfile) {
            await initializePlayerCache();
            const freshGold = await refreshGold();
            currentUserProfile.gold = freshGold;
        }

        await loadCurrentUserProfile();
        await loadLeaderboard();
        updateUserStatus();
    } catch (error) {
        console.error('Erreur refresh:', error);
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.textContent = '🔄 Actualiser';
        }
    }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// Export des fonctions globales - SIMPLIFIÉ (plus de fonctions flèches)
window.showCIG = showCIG;
window.closeCIG = closeCIG;
window.buyTranslator = buyTranslator;
window.considerHelp = considerHelp;
window.helpTraveler = helpTraveler;
window.refuseTraveler = refuseTraveler;
window.ignoreTraveler = ignoreTraveler;
window.fleeFromTraveler = fleeFromTraveler;

// Export pour utilisation externe
window.sternLabLeaderboard = {
    loadLeaderboard,
    refreshLeaderboard,
    changeSortMode,
    toggleLeaderboard,
    showCIG,
    closeCIG
};
