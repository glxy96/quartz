---
title: Audio Player Test
---

# Audio Player Test

This page tests the SyncedAudioPlayer component.

**Note:** To test this player, you need to place actual audio files in the following locations:
- `/static/audio/test/track1.mp3`
- `/static/audio/test/track2.mp3`

Both files should have the same duration and sample rate for proper synchronization.

## Test Player 1: External Config

<div data-audio-player="/static/audio/test/config.json"></div>

## Test Player 2: Inline Config

<div data-audio-player='{
  "contentId": "inline-test",
  "title": "Inline Config Test",
  "tracks": [
    {"id": "a", "label": "Track A", "url": "/static/audio/test/track1.mp3"},
    {"id": "b", "label": "Track B", "url": "/static/audio/test/track2.mp3"}
  ]
}'></div>

## Navigation Test

[Go to index](/) to test SPA navigation and cleanup.

## Testing Checklist

### Basic Functionality
- [ ] Player initializes on page load
- [ ] Player initializes after SPA navigation
- [ ] All audio tracks load successfully
- [ ] Play button starts playback of all tracks
- [ ] Tracks are synchronized (< 50ms drift)
- [ ] Pause button stops playback
- [ ] Seek bar updates during playback
- [ ] Clicking seek bar jumps to correct position
- [ ] Time display shows correct current/total time

### Track Controls
- [ ] Volume sliders adjust individual track volumes
- [ ] Mute checkboxes mute/unmute individual tracks
- [ ] Volume/mute changes are audible during playback
- [ ] All tracks remain synchronized when volumes change

### Responsiveness
- [ ] Layout works on mobile (< 800px width)
- [ ] Layout works on tablet (800-1200px width)
- [ ] Layout works on desktop (> 1200px width)
- [ ] Controls are usable on touch devices

### Theme Integration
- [ ] Player looks correct in light mode
- [ ] Player looks correct in dark mode
- [ ] Switching themes updates player appearance

### SPA & Cleanup
- [ ] Player works on direct page load
- [ ] Player works after SPA navigation
- [ ] Audio stops when navigating away
- [ ] Multiple players on same page work independently
- [ ] No memory leaks on repeated navigation
- [ ] No audio continues after navigation
