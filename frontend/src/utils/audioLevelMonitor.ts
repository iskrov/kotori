/**
 * Simple audio level monitor for debugging microphone input
 */

export class AudioLevelMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private dataArray: Uint8Array | null = null;
  private animationId: number | null = null;
  private onLevelUpdate?: (level: number) => void;

  constructor(onLevelUpdate?: (level: number) => void) {
    this.onLevelUpdate = onLevelUpdate;
  }

  async start() {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      // Create audio context and analyser
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      // Connect microphone to analyser
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);
      
      // Create data array for frequency data
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);
      
      // Start monitoring
      this.monitor();
      
      console.log('[AudioLevelMonitor] Started monitoring microphone levels');
    } catch (error) {
      console.error('[AudioLevelMonitor] Failed to start:', error);
      throw error;
    }
  }

  private monitor = () => {
    if (!this.analyser || !this.dataArray) return;
    
    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);
    
    // Calculate average level
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const average = sum / this.dataArray.length;
    const normalizedLevel = average / 255; // Normalize to 0-1
    
    // Log if level is very low
    if (normalizedLevel < 0.01) {
      console.warn('[AudioLevelMonitor] Very low audio level detected:', normalizedLevel);
    }
    
    // Callback with level
    if (this.onLevelUpdate) {
      this.onLevelUpdate(normalizedLevel);
    }
    
    // Continue monitoring
    this.animationId = requestAnimationFrame(this.monitor);
  };

  stop() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    console.log('[AudioLevelMonitor] Stopped monitoring');
  }
}

