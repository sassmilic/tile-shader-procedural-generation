// The sound page and the mosaic share one transport, backed by the audio clock
// once audio has started.
(() => {
  const initial = Number(new URLSearchParams(location.search).get('t'));
  let position = Number.isFinite(initial) ? Math.max(0, initial) : 0;
  let timeSource = () => performance.now() / 1000;
  let startedAt = timeSource();
  let playing = false;
  const listeners = new Set();

  const positionAt = (now) => playing ? position + (now - startedAt) : position;
  function publish(type) {
    const event = { type, time: position };
    for (const listener of listeners) listener(event);
  }

  window.playback = {
    get time() { return positionAt(timeSource()); },
    get playing() { return playing; },
    play() {
      if (playing) return;
      startedAt = timeSource();
      playing = true;
      publish('play');
    },
    pause() {
      if (!playing) return;
      position = positionAt(timeSource());
      playing = false;
      publish('pause');
    },
    seek(seconds) {
      if (!Number.isFinite(seconds)) return;
      position = Math.max(0, seconds);
      startedAt = timeSource();
      publish('seek');
    },
    useTimeSource(source) {
      position = positionAt(timeSource());
      timeSource = source;
      startedAt = timeSource();
    },
    sourceTimeAt(seconds) { return startedAt + (seconds - position); },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
})();
