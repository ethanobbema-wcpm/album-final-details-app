"use client";

export type AudioDetails = {
  duration: string;
  durationSeconds?: number;
  waveformPeaks?: number[];
};

type WebAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export const AUDIO_FILE_ACCEPT = "audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac,.ogg,.caf,.wma";

const AUDIO_FILE_PATTERN = /\.(wav|aif|aiff|mp3|m4a|flac|ogg|caf|wma)$/i;
const WAVEFORM_BAR_COUNT = 160;
const MIN_WAVEFORM_BAR_HEIGHT = 8;
const MAX_WAVEFORM_BAR_HEIGHT = 52;

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function fallbackWaveformPeaks() {
  return Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
    const primary = Math.sin(index * 0.55) * 0.06;
    const secondary = Math.sin(index * 0.17) * 0.04;
    return clamp(0.36 + primary + secondary, 0.22, 0.52);
  });
}

export function waveformBars(waveformPeaks?: number[]) {
  const peaks = waveformPeaks?.length ? waveformPeaks : fallbackWaveformPeaks();
  const heightRange = MAX_WAVEFORM_BAR_HEIGHT - MIN_WAVEFORM_BAR_HEIGHT;
  return peaks.map((peak) => Math.round(MIN_WAVEFORM_BAR_HEIGHT + clamp(peak) * heightRange));
}

export function trackTitleFromFileName(fileName: string) {
  const base = fileName.replace(/\.[^/.]+$/, "");
  return base.replace(/^\d+[\s.)_-]+/, "").trim() || base;
}

export function isAudioFile(file: File) {
  return file.type.startsWith("audio/") || AUDIO_FILE_PATTERN.test(file.name);
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return "";

  const totalSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

function readAudioMetadata(previewUrl: string) {
  return new Promise<number>((resolve) => {
    const audio = document.createElement("audio");
    const timer = window.setTimeout(() => settle(0), 4000);

    const settle = (duration = 0) => {
      window.clearTimeout(timer);
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => settle(Number.isFinite(audio.duration) ? audio.duration : 0);
    audio.onerror = () => settle(0);
    audio.src = previewUrl;
  });
}

function buildWaveformPeaks(audioBuffer: AudioBuffer) {
  const rawPeaks = Array.from({ length: WAVEFORM_BAR_COUNT }, (_, index) => {
    const start = Math.floor((audioBuffer.length * index) / WAVEFORM_BAR_COUNT);
    const end = Math.floor((audioBuffer.length * (index + 1)) / WAVEFORM_BAR_COUNT);
    const sampleCount = Math.max(1, end - start);
    const stride = Math.max(1, Math.floor(sampleCount / 120));
    let peak = 0;

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const data = audioBuffer.getChannelData(channel);
      for (let sampleIndex = start; sampleIndex < end; sampleIndex += stride) {
        peak = Math.max(peak, Math.abs(data[sampleIndex] || 0));
      }
    }

    return peak;
  });

  const maxPeak = Math.max(...rawPeaks, 0.01);
  return rawPeaks.map((peak) => clamp(peak / maxPeak, 0.08, 1));
}

async function decodeAudioFile(file: File): Promise<Partial<AudioDetails>> {
  const AudioContextConstructor = window.AudioContext || (window as WebAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return {};

  let audioContext: AudioContext | undefined;
  try {
    audioContext = new AudioContextConstructor();
    const audioBuffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    const durationSeconds = Number.isFinite(audioBuffer.duration) ? audioBuffer.duration : 0;
    return {
      durationSeconds: durationSeconds || undefined,
      waveformPeaks: buildWaveformPeaks(audioBuffer)
    };
  } catch {
    return {};
  } finally {
    void audioContext?.close();
  }
}

export async function readAudioDetails(file: File, previewUrl: string): Promise<AudioDetails> {
  const [decodedDetails, metadataDuration] = await Promise.all([decodeAudioFile(file), readAudioMetadata(previewUrl)]);
  const durationSeconds = decodedDetails.durationSeconds || metadataDuration || undefined;
  return {
    duration: durationSeconds ? formatDuration(durationSeconds) : "",
    durationSeconds,
    waveformPeaks: decodedDetails.waveformPeaks
  };
}
