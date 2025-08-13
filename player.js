// DOM Elements
const videoPlayer = document.getElementById('video-player');
const audioPlayer = document.getElementById('audio-player');
const videoSource = document.getElementById('video-source');
const audioSource = document.getElementById('audio-source');
const mediaTitle = document.getElementById('media-title');
const mediaDuration = document.getElementById('media-duration');
const playlistItemsContainer = document.getElementById('playlist-items');
const searchInput = document.querySelector('.search-input');
const searchButton = document.querySelector('.search-button');
const refreshButton = document.getElementById('refresh-button');
const folderButton = document.getElementById('folder-button');

// Configuration
const MEDIA_FOLDER = 'Playlist'; // Current directory
const MEDIA_EXTENSIONS = [
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp',
    '.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'
];

let playlistItems = [];
let currentMediaType = 'video';
let selectedDirectoryHandle = null;
let currentPlayingIndex = -1;

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    setupEventListeners();
    await loadMediaFiles();
    if (playlistItems.length > 0) {
        loadMedia(0); // Load first item
    }
}

function setupEventListeners() {
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => e.key === 'Enter' && handleSearch());
    refreshButton.addEventListener('click', loadMediaFiles);
    folderButton.addEventListener('click', handleFolderSelection);
    
    // Media ended event
    videoPlayer.addEventListener('ended', playNext);
    audioPlayer.addEventListener('ended', playNext);
}

async function loadMediaFiles() {
    try {
        playlistItems = [];
        
        // Try local files first
        if (selectedDirectoryHandle) {
            await loadFromDirectoryHandle();
        } 
        
        // For GitHub Pages, try manifest first, then fallback
        if (playlistItems.length === 0) {
            await loadFromServer();
        }
        
        updatePlaylistUI();
    } catch (error) {
        console.error('Error loading files:', error);
        showErrorMessage('Failed to load media');
    }
}

async function loadFromDirectoryHandle() {
    try {
        for await (const [name, handle] of selectedDirectoryHandle.entries()) {
            if (handle.kind === 'file') {
                const extension = name.substring(name.lastIndexOf('.')).toLowerCase();
                if (MEDIA_EXTENSIONS.some(ext => extension === ext)) {
                    const file = await handle.getFile();
                    const url = URL.createObjectURL(file);
                    const duration = await getMediaDuration(url, extension.includes('mp3') ? 'audio' : 'video');
                    
                    playlistItems.push({
                        name: formatFileName(name),
                        path: url,
                        type: extension.includes('mp3') ? 'audio' : 'video',
                        duration: duration || '0:00'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Directory read error:', error);
    }
}

async function getMediaDuration(url, type) {
    return new Promise((resolve) => {
        const media = type === 'audio' ? new Audio() : document.createElement('video');
        media.src = url;
        media.onloadedmetadata = () => {
            resolve(formatTime(media.duration));
            media.remove();
        };
        media.onerror = () => resolve('0:00');
    });
}

async function loadFromServer() {
    try {
        // Try manifest file first (for GitHub Pages)
        const manifestResponse = await fetch('playlist-manifest.json');
        if (manifestResponse.ok) {
            const manifest = await manifestResponse.json();
            
            for (const item of manifest) {
                const fullPath = `${MEDIA_FOLDER}/${item.filename}`;
                
                playlistItems.push({
                    name: item.name,
                    path: fullPath,
                    type: item.type,
                    duration: '0:00'
                });
            }
            return;
        }
        
        // Fallback to directory listing (for local development)
        await loadFromDirectoryListing();
        
    } catch (error) {
        console.log('Server load failed:', error);
        // Try directory listing as final fallback
        await loadFromDirectoryListing();
    }
}

async function loadFromDirectoryListing() {
    try {
        const response = await fetch(MEDIA_FOLDER);
        if (!response.ok) return;
        
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        
        const links = Array.from(doc.querySelectorAll('a[href]'))
            .map(a => a.getAttribute('href'))
            .filter(href => MEDIA_EXTENSIONS.some(ext => href.toLowerCase().endsWith(ext)));
        
        for (const filePath of links) {
            const fullPath = MEDIA_FOLDER + filePath;
            const fileName = filePath.split('/').pop();
            const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
            
            playlistItems.push({
                name: formatFileName(fileName),
                path: fullPath,
                type: extension.includes('mp3') || extension.includes('.wav') || extension.includes('.ogg') || extension.includes('.aac') || extension.includes('.wma') || extension.includes('.flac') ? 'audio' : 'video',
                duration: '0:00'
            });
        }
    } catch (error) {
        console.log('Directory listing failed:', error);
    }
}

function formatFileName(name) {
    return name
        .replace(/\.[^/.]+$/, '')
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, l => l.toUpperCase());
}

async function handleFolderSelection() {
    if (!window.showDirectoryPicker) {
        alert('File API not supported');
        return;
    }
    
    try {
        folderButton.disabled = true;
        selectedDirectoryHandle = await window.showDirectoryPicker();
        await loadMediaFiles();
    } catch (error) {
        console.log('Directory picker cancelled:', error);
    } finally {
        folderButton.disabled = false;
    }
}

function loadMedia(index) {
    if (index < 0 || index >= playlistItems.length) return;
    
    currentPlayingIndex = index;
    const item = playlistItems[index];
    
    // Reset players
    videoPlayer.pause();
    audioPlayer.pause();
    videoPlayer.style.display = 'none';
    audioPlayer.style.display = 'none';
    
    // Set new media
    const player = item.type === 'audio' ? audioPlayer : videoPlayer;
    const source = item.type === 'audio' ? audioSource : videoSource;
    
    source.src = item.path;
    player.load();
    player.style.display = 'block';
    player.controls = true;
    
    mediaTitle.textContent = item.name;
    mediaDuration.textContent = `0:00 / ${item.duration}`;
    
    player.addEventListener('loadedmetadata', () => {
        const duration = formatTime(player.duration);
        mediaDuration.textContent = `0:00 / ${duration}`;
        
        // Update duration if different
        if (item.duration !== duration) {
            item.duration = duration;
            updatePlaylistUI();
        }
    });
    
    player.addEventListener('timeupdate', updateTimeDisplay);
    
    player.play().catch(e => {
        console.log('Playback failed:', e);
        showErrorMessage("Click the play button to start");
    });
    
    // Highlight current item
    document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.playlist-item')[index]?.classList.add('active');
}

function updateTimeDisplay() {
    const player = currentMediaType === 'audio' ? audioPlayer : videoPlayer;
    const currentTime = formatTime(player.currentTime);
    const duration = formatTime(player.duration);
    mediaDuration.textContent = `${currentTime} / ${duration}`;
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function playNext() {
    if (currentPlayingIndex < playlistItems.length - 1) {
        loadMedia(currentPlayingIndex + 1);
    }
}

function updatePlaylistUI() {
    if (playlistItems.length === 0) {
        playlistItemsContainer.innerHTML = '<li class="no-media">No media files found. Try selecting a folder or check if files are properly deployed.</li>';
        return;
    }
    
    playlistItemsContainer.innerHTML = playlistItems.map((item, index) => `
        <li class="playlist-item ${index === currentPlayingIndex ? 'active' : ''}">
            <i class="fas ${item.type === 'audio' ? 'fa-music' : 'fa-film'}"></i>
            <span class="file-name">${item.name}</span>
            <span class="file-duration">${item.duration}</span>
        </li>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.playlist-item').forEach((item, index) => {
        item.addEventListener('click', () => loadMedia(index));
    });
}

function handleSearch() {
    const term = searchInput.value.toLowerCase().trim();
    if (!term) return updatePlaylistUI();
    
    const filtered = playlistItems.filter(item => 
        item.name.toLowerCase().includes(term)
    );
    
    playlistItemsContainer.innerHTML = filtered.length ? 
        filtered.map((item, index) => `
            <li class="playlist-item">
                <i class="fas ${item.type === 'audio' ? 'fa-music' : 'fa-film'}"></i>
                <span class="file-name">${item.name}</span>
                <span class="file-duration">${item.duration}</span>
            </li>
        `).join('') : 
        `<li class="no-media">No results found</li>`;
}

function showErrorMessage(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}
