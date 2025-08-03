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
const MEDIA_FOLDER = ''; // Set to your folder path or leave empty for same directory
const MEDIA_EXTENSIONS = [
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp',
    '.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'
];

let playlistItems = [];
let currentMediaType = 'video';
let selectedDirectoryHandle = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', initializeApp);

async function initializeApp() {
    // Set up event listeners
    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });
    refreshButton.addEventListener('click', loadMediaFiles);
    folderButton.addEventListener('click', handleFolderSelection);
    
    // Load media files
    await loadMediaFiles();
    
    // Load the first media file if available
    if (playlistItems.length > 0) {
        loadMedia(playlistItems[0].path, playlistItems[0].name, playlistItems[0].type);
    }
}

async function loadMediaFiles() {
    try {
        playlistItems = [];
        
        // Try to load from directory handle first (local files)
        if (selectedDirectoryHandle) {
            await loadFromDirectoryHandle();
            if (playlistItems.length > 0) {
                updatePlaylistUI();
                return;
            }
        }
        
        // Try to load from server
        try {
            const response = await fetch(MEDIA_FOLDER);
            if (response.ok) {
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                const links = Array.from(doc.querySelectorAll('a[href]'))
                    .map(a => a.getAttribute('href'))
                    .filter(href => 
                        href !== '../' && 
                        !href.startsWith('?') && 
                        !href.startsWith('#') &&
                        MEDIA_EXTENSIONS.some(ext => href.toLowerCase().endsWith(ext))
                    );
                
                for (const filePath of links) {
                    const fullPath = MEDIA_FOLDER + filePath;
                    const fileName = filePath.split('/').pop();
                    const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
                    const isAudio = ['.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'].includes(extension);
                    
                    playlistItems.push({
                        name: formatFileName(fileName),
                        path: fullPath,
                        type: isAudio ? 'audio' : 'video',
                        duration: '0:00'
                    });
                }
            }
        } catch (error) {
            console.log('Directory listing not available:', error);
        }
        
        updatePlaylistUI();
    } catch (error) {
        console.error('Error loading media files:', error);
        showErrorMessage('Failed to load media files');
    }
}

function formatFileName(fileName) {
    return fileName
        .replace(/\.[^/.]+$/, '') // Remove extension
        .replace(/_/g, ' ')       // Replace underscores with spaces
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
        .replace(/\b\w/g, l => l.toUpperCase()); // Capitalize first letters
}

async function loadFromDirectoryHandle() {
    try {
        for await (const [name, handle] of selectedDirectoryHandle.entries()) {
            if (handle.kind === 'file') {
                const extension = name.substring(name.lastIndexOf('.')).toLowerCase();
                const isAudio = ['.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'].includes(extension);
                const isVideo = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv'].includes(extension);
                
                if (isAudio || isVideo) {
                    const file = await handle.getFile();
                    const url = URL.createObjectURL(file);
                    
                    playlistItems.push({
                        name: formatFileName(name),
                        path: url,
                        type: isAudio ? 'audio' : 'video',
                        duration: '0:00'
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
        throw error;
    }
}

async function handleFolderSelection() {
    if ('showDirectoryPicker' in window) {
        try {
            folderButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            folderButton.disabled = true;
            
            selectedDirectoryHandle = await window.showDirectoryPicker();
            await loadMediaFiles();
            
            folderButton.innerHTML = '<i class="fas fa-folder-open"></i>';
            folderButton.disabled = false;
        } catch (error) {
            console.log('Directory picker cancelled:', error);
            folderButton.innerHTML = '<i class="fas fa-folder-open"></i>';
            folderButton.disabled = false;
        }
    } else {
        alert('File System Access API not supported in this browser.');
    }
}

function loadMedia(mediaPath, title, type) {
    // Validate input
    if (!mediaPath) {
        showErrorMessage("Invalid file path");
        return;
    }

    // Stop any currently playing media
    if (currentMediaType === 'audio') {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    } else {
        videoPlayer.pause();
        videoPlayer.currentTime = 0;
    }

    // Hide both players first
    videoPlayer.style.display = 'none';
    audioPlayer.style.display = 'none';
    
    if (type === 'audio') {
        currentMediaType = 'audio';
        audioSource.src = mediaPath;
        audioPlayer.load();
        audioPlayer.style.display = 'block';
        audioPlayer.controls = true;
        
        audioPlayer.play().catch(e => {
            console.log('Audio playback failed:', e);
            showErrorMessage("Click the play button to start playback");
        });
    } else {
        currentMediaType = 'video';
        videoSource.src = mediaPath;
        videoPlayer.load();
        videoPlayer.style.display = 'block';
        videoPlayer.controls = true;
        
        videoPlayer.play().catch(e => {
            console.log('Video playback failed:', e);
            showErrorMessage("Click the play button to start playback");
        });
    }
    
    mediaTitle.textContent = title;
    mediaDuration.textContent = '0:00 / 0:00';
    
    const player = type === 'audio' ? audioPlayer : videoPlayer;
    
    player.addEventListener('loadedmetadata', () => {
        const duration = formatTime(player.duration);
        mediaDuration.textContent = `0:00 / ${duration}`;
        
        // Update duration in playlist
        const itemIndex = playlistItems.findIndex(item => item.path === mediaPath);
        if (itemIndex !== -1) {
            playlistItems[itemIndex].duration = duration;
            updatePlaylistUI();
        }
    });
    
    player.addEventListener('timeupdate', () => {
        const currentTime = formatTime(player.currentTime);
        const duration = formatTime(player.duration);
        mediaDuration.textContent = `${currentTime} / ${duration}`;
    });
    
    player.addEventListener('error', (e) => {
        console.error('Media loading error:', player.error);
        mediaTitle.textContent = `${title} (Error loading)`;
        showErrorMessage(`Failed to load: ${title} (${player.error ? player.error.message : 'Unknown error'})`);
    });
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function updatePlaylistUI() {
    playlistItemsContainer.innerHTML = '';
    
    if (playlistItems.length === 0) {
        const noMediaItem = document.createElement('li');
        noMediaItem.className = 'no-media';
        noMediaItem.textContent = 'No media files found';
        playlistItemsContainer.appendChild(noMediaItem);
        return;
    }
    
    playlistItems.forEach((item, index) => {
        const playlistItem = document.createElement('li');
        playlistItem.className = 'playlist-item';
        
        const fileIcon = document.createElement('i');
        fileIcon.className = item.type === 'audio' ? 'fas fa-music' : 'fas fa-film';
        
        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.textContent = item.name;
        
        const fileDuration = document.createElement('span');
        fileDuration.className = 'file-duration';
        fileDuration.textContent = item.duration;
        
        playlistItem.appendChild(fileIcon);
        playlistItem.appendChild(fileName);
        playlistItem.appendChild(fileDuration);
        
        playlistItem.addEventListener('click', () => {
            // Remove active class from all items
            document.querySelectorAll('.playlist-item').forEach(el => {
                el.classList.remove('active');
            });
            
            // Add active class to clicked item
            playlistItem.classList.add('active');
            
            // Load the selected media
            loadMedia(item.path, item.name, item.type);
        });
        
        playlistItemsContainer.appendChild(playlistItem);
    });
}

function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        updatePlaylistUI();
        return;
    }
    
    const filteredItems = playlistItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
    );
    
    if (filteredItems.length === 0) {
        playlistItemsContainer.innerHTML = `
            <li class="no-media">
                No results found for "${searchTerm}"
            </li>
        `;
    } else {
        playlistItemsContainer.innerHTML = '';
        filteredItems.forEach(item => {
            const playlistItem = document.createElement('li');
            playlistItem.className = 'playlist-item';
            
            const fileIcon = document.createElement('i');
            fileIcon.className = item.type === 'audio' ? 'fas fa-music' : 'fas fa-film';
            
            const fileName = document.createElement('span');
            fileName.className = 'file-name';
            fileName.textContent = item.name;
            
            const fileDuration = document.createElement('span');
            fileDuration.className = 'file-duration';
            fileDuration.textContent = item.duration;
            
            playlistItem.appendChild(fileIcon);
            playlistItem.appendChild(fileName);
            playlistItem.appendChild(fileDuration);
            
            playlistItem.addEventListener('click', () => {
                loadMedia(item.path, item.name, item.type);
            });
            
            playlistItemsContainer.appendChild(playlistItem);
        });
    }
}

function showErrorMessage(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    
    errorElement.style.position = 'fixed';
    errorElement.style.bottom = '20px';
    errorElement.style.right = '20px';
    errorElement.style.backgroundColor = '#ff4444';
    errorElement.style.color = 'white';
    errorElement.style.padding = '10px 20px';
    errorElement.style.borderRadius = '5px';
    errorElement.style.zIndex = '1000';
    
    document.body.appendChild(errorElement);
    
    setTimeout(() => {
        errorElement.remove();
    }, 3000);
}