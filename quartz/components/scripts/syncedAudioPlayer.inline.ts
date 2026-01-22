// SyncedAudioPlayer inline script
// Handles multi-track synchronized audio playback using Web Audio API

interface PlayerConfig {
  contentId: string
  title?: string
  tracks: TrackConfig[]
}

interface TrackConfig {
  id: string
  label: string
  url: string
  volume?: number
}

interface AudioTrack {
  id: string
  label: string
  url: string
  buffer: AudioBuffer | null
  source: AudioBufferSourceNode | null
  gainNode: GainNode
  volume: number
}

interface PlayerState {
  isPlaying: boolean
  currentTime: number
  duration: number
  startTime: number // audioContext.currentTime when playback started
  pauseTime: number // time when paused
  tracks: AudioTrack[]
  audioContext: AudioContext
  animationFrameId: number | null
}

// Store active players for cleanup
const activePlayers: Map<string, PlayerState> = new Map()

/**
 * Initialize all audio players on the page
 */
function initializePlayers() {
  const playerElements = document.querySelectorAll<HTMLElement>("[data-audio-player]")

  playerElements.forEach((element) => {
    const configData = element.dataset.audioPlayer
    if (!configData) return

    // Check if this element already has a player
    const existingPlayerId = element.dataset.playerId
    if (existingPlayerId && activePlayers.has(existingPlayerId)) {
      return // Player already initialized
    }

    // Load config (either inline JSON or external URL)
    if (configData.startsWith("{")) {
      // Inline JSON config
      try {
        const config = JSON.parse(configData) as PlayerConfig
        initializePlayer(element, config)
      } catch (error) {
        console.error("Failed to parse inline audio player config:", error)
        showError(element, "Invalid configuration format")
      }
    } else {
      // External config file
      fetch(configData)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load config: ${response.statusText}`)
          }
          return response.json()
        })
        .then((config: PlayerConfig) => {
          initializePlayer(element, config)
        })
        .catch((error) => {
          console.error("Failed to load audio player config:", error)
          showError(element, `Failed to load configuration: ${error.message}`)
        })
    }
  })
}

/**
 * Initialize a single player instance
 */
async function initializePlayer(container: HTMLElement, config: PlayerConfig) {
  // Create audio context
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

  // Create player state
  const state: PlayerState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    startTime: 0,
    pauseTime: 0,
    tracks: [],
    audioContext,
    animationFrameId: null,
  }

  // Store player ID for cleanup
  const playerId = `player-${config.contentId}-${Date.now()}`
  container.dataset.playerId = playerId
  activePlayers.set(playerId, state)

  // Build UI
  const playerUI = buildPlayerUI(container, config)

  // Show loading state
  const loadingIndicator = playerUI.querySelector(".loading-indicator") as HTMLElement
  loadingIndicator.style.display = "block"

  try {
    // Load all audio tracks
    await loadTracks(config.tracks, state)

    // Set duration from first track
    if (state.tracks.length > 0 && state.tracks[0].buffer) {
      state.duration = state.tracks[0].buffer.duration
    }

    // Hide loading indicator
    loadingIndicator.style.display = "none"

    // Setup controls
    setupPlaybackControls(playerUI, state)

    // Update initial time display
    updateTimeDisplay(playerUI, state)
  } catch (error) {
    console.error("Failed to initialize audio player:", error)
    showError(container, `Failed to load audio tracks: ${(error as Error).message}`)
    loadingIndicator.style.display = "none"
  }
}

/**
 * Load all audio tracks
 */
async function loadTracks(trackConfigs: TrackConfig[], state: PlayerState): Promise<void> {
  const loadPromises = trackConfigs.map(async (trackConfig) => {
    const track: AudioTrack = {
      id: trackConfig.id,
      label: trackConfig.label,
      url: trackConfig.url,
      buffer: null,
      source: null,
      gainNode: state.audioContext.createGain(),
      volume: trackConfig.volume ?? 1.0,
    }

    // Set initial volume
    track.gainNode.gain.value = track.volume

    try {
      // Fetch audio file
      const response = await fetch(trackConfig.url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const arrayBuffer = await response.arrayBuffer()

      // Decode audio data
      track.buffer = await state.audioContext.decodeAudioData(arrayBuffer)

      state.tracks.push(track)
    } catch (error) {
      console.error(`Failed to load track ${trackConfig.label}:`, error)
      throw new Error(`Failed to load "${trackConfig.label}": ${(error as Error).message}`)
    }
  })

  await Promise.all(loadPromises)
}

/**
 * Build the player UI
 */
function buildPlayerUI(container: HTMLElement, config: PlayerConfig): HTMLElement {
  const playerDiv = document.createElement("div")
  playerDiv.className = "synced-audio-player"

  // Title
  if (config.title) {
    const title = document.createElement("h4")
    title.className = "player-title"
    title.textContent = config.title
    playerDiv.appendChild(title)
  }

  // Loading indicator
  const loadingIndicator = document.createElement("div")
  loadingIndicator.className = "loading-indicator"
  loadingIndicator.textContent = "Loading audio tracks..."
  loadingIndicator.style.display = "none"
  playerDiv.appendChild(loadingIndicator)

  // Error display
  const errorDisplay = document.createElement("div")
  errorDisplay.className = "error-display"
  errorDisplay.style.display = "none"
  playerDiv.appendChild(errorDisplay)

  // Main controls
  const mainControls = document.createElement("div")
  mainControls.className = "main-controls"

  const playPauseBtn = document.createElement("button")
  playPauseBtn.className = "play-pause-btn"
  playPauseBtn.innerHTML = "▶"
  playPauseBtn.setAttribute("aria-label", "Play")
  mainControls.appendChild(playPauseBtn)

  const timeDisplay = document.createElement("div")
  timeDisplay.className = "time-display"
  timeDisplay.textContent = "0:00 / 0:00"
  mainControls.appendChild(timeDisplay)

  playerDiv.appendChild(mainControls)

  // Seek bar
  const seekBar = document.createElement("input")
  seekBar.type = "range"
  seekBar.className = "seek-bar"
  seekBar.min = "0"
  seekBar.max = "1000"
  seekBar.value = "0"
  seekBar.setAttribute("aria-label", "Seek")
  playerDiv.appendChild(seekBar)

  // Track controls
  const trackControls = document.createElement("div")
  trackControls.className = "track-controls"

  config.tracks.forEach((track) => {
    const trackControl = document.createElement("div")
    trackControl.className = "track-control"
    trackControl.dataset.trackId = track.id

    const trackLabel = document.createElement("span")
    trackLabel.className = "track-label"
    trackLabel.textContent = track.label
    trackControl.appendChild(trackLabel)

    const volumeControl = document.createElement("input")
    volumeControl.type = "range"
    volumeControl.className = "volume-slider"
    volumeControl.min = "0"
    volumeControl.max = "100"
    volumeControl.value = String((track.volume ?? 1.0) * 100)
    volumeControl.setAttribute("aria-label", `Volume for ${track.label}`)
    trackControl.appendChild(volumeControl)

    const muteCheckbox = document.createElement("input")
    muteCheckbox.type = "checkbox"
    muteCheckbox.className = "mute-checkbox"
    muteCheckbox.id = `mute-${config.contentId}-${track.id}`
    muteCheckbox.setAttribute("aria-label", `Mute ${track.label}`)

    const muteLabel = document.createElement("label")
    muteLabel.htmlFor = muteCheckbox.id
    muteLabel.textContent = "Mute"
    muteLabel.className = "mute-label"

    trackControl.appendChild(muteCheckbox)
    trackControl.appendChild(muteLabel)

    trackControls.appendChild(trackControl)
  })

  playerDiv.appendChild(trackControls)

  container.appendChild(playerDiv)

  return playerDiv
}

/**
 * Setup playback controls
 */
function setupPlaybackControls(playerUI: HTMLElement, state: PlayerState) {
  const playPauseBtn = playerUI.querySelector(".play-pause-btn") as HTMLButtonElement
  const seekBar = playerUI.querySelector(".seek-bar") as HTMLInputElement
  const trackControls = playerUI.querySelectorAll(".track-control")

  // Play/Pause button
  playPauseBtn.addEventListener("click", () => {
    if (state.isPlaying) {
      pausePlayback(playerUI, state)
    } else {
      startPlayback(playerUI, state)
    }
  })

  // Seek bar
  let isSeeking = false

  seekBar.addEventListener("mousedown", () => {
    isSeeking = true
  })

  seekBar.addEventListener("mouseup", () => {
    isSeeking = false
  })

  seekBar.addEventListener("touchstart", () => {
    isSeeking = true
  })

  seekBar.addEventListener("touchend", () => {
    isSeeking = false
  })

  seekBar.addEventListener("input", () => {
    if (!isSeeking) return

    const seekTime = (parseFloat(seekBar.value) / 1000) * state.duration
    seekToTime(playerUI, state, seekTime)
  })

  seekBar.addEventListener("change", () => {
    const seekTime = (parseFloat(seekBar.value) / 1000) * state.duration
    seekToTime(playerUI, state, seekTime)
  })

  // Track volume and mute controls
  trackControls.forEach((trackControl) => {
    const trackId = (trackControl as HTMLElement).dataset.trackId
    const track = state.tracks.find((t) => t.id === trackId)
    if (!track) return

    const volumeSlider = trackControl.querySelector(".volume-slider") as HTMLInputElement
    const muteCheckbox = trackControl.querySelector(".mute-checkbox") as HTMLInputElement

    volumeSlider.addEventListener("input", () => {
      const volume = parseFloat(volumeSlider.value) / 100
      track.volume = volume
      if (!muteCheckbox.checked) {
        track.gainNode.gain.value = volume
      }
    })

    muteCheckbox.addEventListener("change", () => {
      if (muteCheckbox.checked) {
        track.gainNode.gain.value = 0
      } else {
        track.gainNode.gain.value = track.volume
      }
    })
  })
}

/**
 * Start playback
 */
function startPlayback(playerUI: HTMLElement, state: PlayerState) {
  // Resume audio context if suspended
  if (state.audioContext.state === "suspended") {
    state.audioContext.resume()
  }

  // Create new source nodes for all tracks
  state.tracks.forEach((track) => {
    if (!track.buffer) return

    const source = state.audioContext.createBufferSource()
    source.buffer = track.buffer
    source.connect(track.gainNode)
    track.gainNode.connect(state.audioContext.destination)
    track.source = source

    // Handle playback end
    source.onended = () => {
      if (state.isPlaying && state.currentTime >= state.duration - 0.1) {
        // Playback finished
        pausePlayback(playerUI, state)
        state.currentTime = 0
        updateTimeDisplay(playerUI, state)
        updateSeekBar(playerUI, state)
      }
    }
  })

  // Start all sources at synchronized time
  const startTime = state.audioContext.currentTime + 0.01
  state.startTime = startTime - state.currentTime

  state.tracks.forEach((track) => {
    if (track.source && track.buffer) {
      track.source.start(startTime, state.currentTime)
    }
  })

  state.isPlaying = true

  // Update UI
  const playPauseBtn = playerUI.querySelector(".play-pause-btn") as HTMLButtonElement
  playPauseBtn.innerHTML = "⏸"
  playPauseBtn.setAttribute("aria-label", "Pause")

  // Start animation loop
  updatePlaybackTime(playerUI, state)
}

/**
 * Pause playback
 */
function pausePlayback(playerUI: HTMLElement, state: PlayerState) {
  // Stop all source nodes
  state.tracks.forEach((track) => {
    if (track.source) {
      try {
        track.source.stop()
      } catch (error) {
        // Ignore errors from already stopped sources
      }
      track.source = null
    }
  })

  state.isPlaying = false
  state.pauseTime = state.audioContext.currentTime

  // Update UI
  const playPauseBtn = playerUI.querySelector(".play-pause-btn") as HTMLButtonElement
  playPauseBtn.innerHTML = "▶"
  playPauseBtn.setAttribute("aria-label", "Play")

  // Stop animation loop
  if (state.animationFrameId !== null) {
    cancelAnimationFrame(state.animationFrameId)
    state.animationFrameId = null
  }
}

/**
 * Seek to specific time
 */
function seekToTime(playerUI: HTMLElement, state: PlayerState, time: number) {
  const wasPlaying = state.isPlaying

  if (wasPlaying) {
    pausePlayback(playerUI, state)
  }

  state.currentTime = Math.max(0, Math.min(time, state.duration))

  updateTimeDisplay(playerUI, state)
  updateSeekBar(playerUI, state)

  if (wasPlaying) {
    startPlayback(playerUI, state)
  }
}

/**
 * Update playback time (animation loop)
 */
function updatePlaybackTime(playerUI: HTMLElement, state: PlayerState) {
  if (!state.isPlaying) return

  state.currentTime = state.audioContext.currentTime - state.startTime

  // Clamp to duration
  if (state.currentTime >= state.duration) {
    state.currentTime = state.duration
  }

  updateTimeDisplay(playerUI, state)
  updateSeekBar(playerUI, state)

  // Continue animation loop
  state.animationFrameId = requestAnimationFrame(() => updatePlaybackTime(playerUI, state))
}

/**
 * Update time display
 */
function updateTimeDisplay(playerUI: HTMLElement, state: PlayerState) {
  const timeDisplay = playerUI.querySelector(".time-display") as HTMLElement
  if (!timeDisplay) return

  const currentTimeStr = formatTime(state.currentTime)
  const durationStr = formatTime(state.duration)

  timeDisplay.textContent = `${currentTimeStr} / ${durationStr}`
}

/**
 * Update seek bar position
 */
function updateSeekBar(playerUI: HTMLElement, state: PlayerState) {
  const seekBar = playerUI.querySelector(".seek-bar") as HTMLInputElement
  if (!seekBar) return

  const progress = state.duration > 0 ? (state.currentTime / state.duration) * 1000 : 0
  seekBar.value = String(progress)
}

/**
 * Format time in M:SS format
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

/**
 * Show error message
 */
function showError(container: HTMLElement, message: string) {
  const playerDiv = container.querySelector(".synced-audio-player")
  if (!playerDiv) {
    const errorDiv = document.createElement("div")
    errorDiv.className = "synced-audio-player error"
    errorDiv.innerHTML = `<div class="error-display" style="display: block; color: red; padding: 1rem;">${message}</div>`
    container.appendChild(errorDiv)
    return
  }

  const errorDisplay = playerDiv.querySelector(".error-display") as HTMLElement
  if (errorDisplay) {
    errorDisplay.textContent = message
    errorDisplay.style.display = "block"
  }
}

/**
 * Cleanup all players
 */
function cleanupPlayers() {
  activePlayers.forEach((state, playerId) => {
    // Stop playback
    if (state.isPlaying) {
      state.tracks.forEach((track) => {
        if (track.source) {
          try {
            track.source.stop()
          } catch (error) {
            // Ignore errors
          }
        }
      })
    }

    // Stop animation loop
    if (state.animationFrameId !== null) {
      cancelAnimationFrame(state.animationFrameId)
    }

    // Close audio context
    if (state.audioContext.state !== "closed") {
      state.audioContext.close()
    }
  })

  activePlayers.clear()
}

// Initialize players on page load
document.addEventListener("nav", () => {
  // Clean up existing players
  cleanupPlayers()

  // Wait a bit for content to be loaded
  setTimeout(() => {
    initializePlayers()
  }, 10)
})

// Register cleanup for SPA navigation
if (window.addCleanup) {
  window.addCleanup(() => cleanupPlayers())
}
