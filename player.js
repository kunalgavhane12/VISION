// DOM Elements
const videoPlayer = document.getElementById('video-player');
const audioPlayer = document.getElementById('audio-player');
const videoSource = document.getElementById('video-source');
const audioSource = document.getElementById('audio-source');
const mediaTitle = document.getElementById('media-title');
const mediaDuration = document.getElementById('media-duration');
const playlistList = document.getElementById('playlist-list');
const refreshButton = document.getElementById('refresh-playlist');
const pickFolderButton = document.getElementById('pick-folder');
const searchInput = document.querySelector('.search-input');
const searchButton = document.querySelector('.search-button');

// Configuration
const MEDIA_FOLDER = 'Playlist/';
const MEDIA_EXTENSIONS = [
    '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv', '.m4v', '.3gp',
    '.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'
];

let playlistItems = [];
let currentMediaType = 'video';
let selectedDirectoryHandle = null;

// Initialize the application
const initializeApp = async () => {
    await loadMediaFiles();
    if (playlistItems.length > 0) {
        loadMedia(playlistItems[0].path, playlistItems[0].name, playlistItems[0].type);
    }
};

// Load all media files from Playlist folder
const loadMediaFiles = async () => {
    playlistItems = [];
    
    // Method 1: Use selected directory handle if available (local files)
    if (selectedDirectoryHandle) {
        await loadFromDirectoryHandle();
        if (playlistItems.length > 0) {
            updatePlaylist();
            return;
        }
    }
    
    // Method 2: Try to get files from server
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
                
                const isPlayable = await testMediaFile(fullPath);
                if (isPlayable) {
                    playlistItems.push({
                        name: fileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
                        path: fullPath,
                        type: isAudio ? 'audio' : 'video',
                        extension: extension,
                        duration: "00:00"
                    });
                }
            }
        }
    } catch (error) {
        console.log('Directory listing not available:', error);
    }
    
    // Method 3: Try known files as fallback
    if (playlistItems.length === 0) {
        const knownFiles = [
            'Kevadyacha_Paan_Tu.mp4',
            'Namani_Shamisha.mp4',
            'Els_Phool_TDM_Bhauzao_Ka.mp4',
            'raam-savenge-swati-mishra-bhajan.mp3'
        ];
        
        for (const fileName of knownFiles) {
            const fullPath = MEDIA_FOLDER + fileName;
            const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
            const isAudio = ['.mp3', '.wav', '.ogg', '.aac', '.wma', '.flac'].includes(extension);
            
            const isPlayable = await testMediaFile(fullPath);
            if (isPlayable) {
                playlistItems.push({
                    name: fileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
                    path: fullPath,
                    type: isAudio ? 'audio' : 'video',
                    extension: extension,
                    duration: "00:00"
                });
            }
        }
    }
    
    playlistItems.sort((a, b) => a.name.localeCompare(b.name));
    updatePlaylist();
};

// Load media files from directory handle (local files)
const loadFromDirectoryHandle = async () => {
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
                        name: name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
                        path: url,
                        type: isAudio ? 'audio' : 'video',
                        extension: extension,
                        duration: "00:00"
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
    }
};

// Test if a media file exists and is playable
const testMediaFile = (filePath) => {
    return new Promise((resolve) => {
        const isAudio = filePath.toLowerCase().endsWith('.mp3') || 
                       filePath.toLowerCase().endsWith('.wav') ||
                       filePath.toLowerCase().endsWith('.ogg') ||
                       filePath.toLowerCase().endsWith('.aac') ||
                       filePath.toLowerCase().endsWith('.wma') ||
                       filePath.toLowerCase().endsWith('.flac');
        
        const testElement = document.createElement(isAudio ? 'audio' : 'video');
        testElement.preload = 'metadata';
        testElement.muted = true;
        
        const cleanup = () => {
            testElement.removeEventListener('loadedmetadata', onLoad);
            testElement.removeEventListener('error', onError);
            testElement.src = '';
        };
        
        const onLoad = () => {
            cleanup();
            resolve(true);
        };
        
        const onError = () => {
            cleanup();
            resolve(false);
        };
        
        testElement.addEventListener('loadedmetadata', onLoad);
        testElement.addEventListener('error', onError);
        
        setTimeout(() => {
            cleanup();
            resolve(false);
        }, 2000);
        
        testElement.src = filePath;
    });
};

// Load a media file into the player
const loadMedia = (mediaPath, title, type) => {
    // First stop any currently playing media
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
        audioPlayer.play().catch(e => {
            console.log('Autoplay prevented:', e);
            audioPlayer.controls = true;
        });
    } else {
        currentMediaType = 'video';
        videoSource.src = mediaPath;
        videoPlayer.load();
        videoPlayer.style.display = 'block';
        videoPlayer.play().catch(e => {
            console.log('Autoplay prevented:', e);
            videoPlayer.controls = true;
        });
    }
    
    mediaTitle.textContent = title;
    mediaDuration.textContent = 'Duration: 00:00';
    
    const player = type === 'audio' ? audioPlayer : videoPlayer;
    
    player.addEventListener('loadedmetadata', () => {
        const minutes = Math.floor(player.duration / 60);
        const seconds = Math.floor(player.duration % 60);
        const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        mediaDuration.textContent = `Duration: ${durationStr}`;
        
        // Update duration in playlist
        const itemIndex = playlistItems.findIndex(item => item.path === mediaPath);
        if (itemIndex !== -1) {
            playlistItems[itemIndex].duration = durationStr;
            const durationElement = playlistList.children[itemIndex].querySelector('.file-duration');
            if (durationElement) {
                durationElement.textContent = durationStr;
            }
        }
    });
    
    player.addEventListener('error', (e) => {
        console.error('Media loading error:', e);
        mediaTitle.textContent = `${title} (Error loading)`;
        
        // For local files, try using object URLs
        if (mediaPath.startsWith('Playlist/') || mediaPath.startsWith('./Playlist/')) {
            console.log('Trying alternative loading method for local file');
            handleLocalFileError(mediaPath, title, type);
        }
    });
};

// Alternative method for loading local files
const handleLocalFileError = async (filePath, title, type) => {
    try {
        // Remove the Playlist/ prefix if present
        const fileName = filePath.replace(/^Playlist\//, '').replace(/^\.\/Playlist\//, '');
        const response = await fetch(fileName);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        if (type === 'audio') {
            audioSource.src = url;
            audioPlayer.load();
            audioPlayer.play().catch(e => console.log('Autoplay prevented:', e));
        } else {
            videoSource.src = url;
            videoPlayer.load();
            videoPlayer.play().catch(e => console.log('Autoplay prevented:', e));
        }
        
        mediaTitle.textContent = title;
    } catch (error) {
        console.error('Failed to load local file:', error);
    }
};

// Update the playlist UI
const updatePlaylist = () => {
    playlistList.innerHTML = '';
    
    if (playlistItems.length === 0) {
        const noMedia = document.createElement('li');
        noMedia.className = 'no-media';
        noMedia.innerHTML = `
            <i class="fas fa-music" style="font-size: 24px; margin-bottom: 10px;"></i><br>
            No media files found in ${MEDIA_FOLDER}<br>
            <small>Supported formats: ${MEDIA_EXTENSIONS.join(', ')}</small>
        `;
        playlistList.appendChild(noMedia);
        return;
    }
    
    playlistItems.forEach((item, index) => {
        const playlistItem = document.createElement('li');
        playlistItem.className = 'playlist-item';
        if (index === 0) playlistItem.classList.add('active');
        
        const iconClass = item.type === 'audio' ? 'fa-file-audio' : 'fa-file-video';
        
        playlistItem.innerHTML = `
            <i class="fas ${iconClass} file-icon"></i>
            <span class="file-name">${item.name}</span>
            <span class="file-duration">${item.duration}</span>
        `;
        
        playlistItem.addEventListener('click', () => {
            document.querySelectorAll('.playlist-item').forEach(el => {
                el.classList.remove('active');
            });
            playlistItem.classList.add('active');
            loadMedia(item.path, item.name, item.type);
        });
        
        playlistList.appendChild(playlistItem);
    });
};

// Folder picker button (for local use)
pickFolderButton.addEventListener('click', async () => {
    if ('showDirectoryPicker' in window) {
        try {
            pickFolderButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Selecting...';
            pickFolderButton.disabled = true;
            
            selectedDirectoryHandle = await window.showDirectoryPicker();
            
            await loadMediaFiles();
            
            pickFolderButton.innerHTML = '<i class="fas fa-folder-open"></i> Folder';
            pickFolderButton.disabled = false;
        } catch (error) {
            console.log('Directory picker cancelled:', error);
            pickFolderButton.innerHTML = '<i class="fas fa-folder-open"></i> Folder';
            pickFolderButton.disabled = false;
        }
    } else {
        alert('File System Access API not supported in this browser.');
    }
});

// Refresh button
refreshButton.addEventListener('click', async () => {
    refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    refreshButton.disabled = true;
    
    await loadMediaFiles();
    
    refreshButton.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh';
    refreshButton.disabled = false;
});

// Search functionality
searchButton.addEventListener('click', () => {
    const searchTerm = searchInput.value.toLowerCase();
    if (!searchTerm) {
        updatePlaylist();
        return;
    }
    
    const filteredItems = playlistItems.filter(item => 
        item.name.toLowerCase().includes(searchTerm)
    );
    
    if (filteredItems.length === 0) {
        playlistList.innerHTML = `
            <li class="no-media">
                <i class="fas fa-search" style="font-size: 24px; margin-bottom: 10px;"></i><br>
                No results found for "${searchTerm}"<br>
                <small>Try a different search term</small>
            </li>
        `;
    } else {
        playlistList.innerHTML = '';
        filteredItems.forEach(item => {
            const playlistItem = document.createElement('li');
            playlistItem.className = 'playlist-item';
            
            const iconClass = item.type === 'audio' ? 'fa-file-audio' : 'fa-file-video';
            
            playlistItem.innerHTML = `
                <i class="fas ${iconClass} file-icon"></i>
                <span class="file-name">${item.name}</span>
                <span class="file-duration">${item.duration}</span>
            `;
            
            playlistItem.addEventListener('click', () => {
                loadMedia(item.path, item.name, item.type);
            });
            
            playlistList.appendChild(playlistItem);
        });
    }
});

// Initialize the app
document.addEventListener('DOMContentLoaded', initializeApp);