import { useRef, useCallback, useState, useEffect } from 'react';
import { Animated } from 'react-native';

interface ScrollPerformanceMetrics {
  fps: number;
  averageFps: number;
  scrollDistance: number;
  scrollVelocity: number;
  frameDrops: number;
  isScrolling: boolean;
  memoryUsage?: number;
}

interface UseScrollPerformanceOptions {
  enableFpsMonitoring?: boolean;
  enableMemoryMonitoring?: boolean;
  fpsThreshold?: number; // Alert if FPS drops below this value
  reportInterval?: number; // How often to update metrics (ms)
}

export const useScrollPerformance = (options: UseScrollPerformanceOptions = {}) => {
  const {
    enableFpsMonitoring = true,
    enableMemoryMonitoring = false,
    fpsThreshold = 45,
    reportInterval = 1000,
  } = options;

  // Performance tracking state
  const [metrics, setMetrics] = useState<ScrollPerformanceMetrics>({
    fps: 60,
    averageFps: 60,
    scrollDistance: 0,
    scrollVelocity: 0,
    frameDrops: 0,
    isScrolling: false,
  });

  // Refs for tracking
  const frameCount = useRef(0);
  const lastFrameTime = useRef(Date.now());
  const fpsHistory = useRef<number[]>([]);
  const scrollStartTime = useRef(0);
  const lastScrollY = useRef(0);
  const scrollVelocityHistory = useRef<number[]>([]);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  // FPS monitoring
  const measureFps = useCallback(() => {
    if (!enableFpsMonitoring) return;

    const now = Date.now();
    const deltaTime = now - lastFrameTime.current;
    
    if (deltaTime > 0) {
      const currentFps = Math.min(1000 / deltaTime, 60);
      frameCount.current++;
      
      // Track FPS history for averaging
      fpsHistory.current.push(currentFps);
      if (fpsHistory.current.length > 60) { // Keep last 60 frames
        fpsHistory.current.shift();
      }
      
      const averageFps = fpsHistory.current.reduce((a, b) => a + b, 0) / fpsHistory.current.length;
      
      // Count frame drops (FPS below threshold)
      const frameDrops = fpsHistory.current.filter(fps => fps < fpsThreshold).length;
      
      setMetrics(prev => ({
        ...prev,
        fps: Math.round(currentFps),
        averageFps: Math.round(averageFps),
        frameDrops,
      }));
    }
    
    lastFrameTime.current = now;
  }, [enableFpsMonitoring, fpsThreshold]);

  // Memory monitoring (simplified - actual implementation would need native modules)
  const measureMemory = useCallback(() => {
    if (!enableMemoryMonitoring) return;
    
    // In a real implementation, this would use native modules
    // For now, we'll simulate memory tracking
    if ((global as any).performance && (global as any).performance.memory) {
      const memory = (global as any).performance.memory;
      setMetrics(prev => ({
        ...prev,
        memoryUsage: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      }));
    }
  }, [enableMemoryMonitoring]);

  // Scroll event handler with performance tracking
  const handleScroll = useCallback((event: any) => {
    const { contentOffset } = event.nativeEvent;
    const currentY = contentOffset.y;
    const now = Date.now();
    
    // Track scroll start
    if (!isScrollingRef.current) {
      isScrollingRef.current = true;
      scrollStartTime.current = now;
      setMetrics(prev => ({ ...prev, isScrolling: true }));
    }
    
    // Calculate scroll velocity
    const deltaY = Math.abs(currentY - lastScrollY.current);
    const velocity = deltaY / 16; // Assuming 60fps (16ms per frame)
    
    scrollVelocityHistory.current.push(velocity);
    if (scrollVelocityHistory.current.length > 10) {
      scrollVelocityHistory.current.shift();
    }
    
    const averageVelocity = scrollVelocityHistory.current.reduce((a, b) => a + b, 0) / scrollVelocityHistory.current.length;
    
    setMetrics(prev => ({
      ...prev,
      scrollDistance: prev.scrollDistance + deltaY,
      scrollVelocity: Math.round(averageVelocity),
    }));
    
    lastScrollY.current = currentY;
    
    // Measure FPS during scroll
    measureFps();
    
    // Reset scroll timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
      setMetrics(prev => ({ ...prev, isScrolling: false }));
    }, 150);
  }, [measureFps]);

  // Performance reporting
  const reportPerformance = useCallback(() => {
    const report = {
      timestamp: new Date().toISOString(),
      ...metrics,
      frameCount: frameCount.current,
      scrollDuration: isScrollingRef.current ? Date.now() - scrollStartTime.current : 0,
    };
    
    // In a production app, you would send this to analytics
    console.log('Scroll Performance Report:', report);
    
    // Alert on poor performance
    if (metrics.averageFps < fpsThreshold) {
      console.warn(`Poor scroll performance detected: ${metrics.averageFps} FPS (threshold: ${fpsThreshold})`);
    }
    
    return report;
  }, [metrics, fpsThreshold]);

  // Performance monitoring interval
  useEffect(() => {
    const interval = setInterval(() => {
      measureMemory();
      reportPerformance();
    }, reportInterval);
    
    return () => clearInterval(interval);
  }, [measureMemory, reportPerformance, reportInterval]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Animated scroll handler for better performance
  const animatedScrollHandler = useCallback(
    Animated.event(
      [{ nativeEvent: { contentOffset: { y: new Animated.Value(0) } } }],
      {
        useNativeDriver: false,
        listener: handleScroll,
      }
    ),
    [handleScroll]
  );

  // Performance optimization utilities
  const optimizationTips = useCallback(() => {
    const tips: string[] = [];
    
    if (metrics.averageFps < 50) {
      tips.push('Consider reducing the number of rendered items');
      tips.push('Enable removeClippedSubviews for large lists');
    }
    
    if (metrics.frameDrops > 10) {
      tips.push('Optimize heavy components in list items');
      tips.push('Use getItemLayout for consistent item heights');
    }
    
    if (metrics.memoryUsage && metrics.memoryUsage > 100) {
      tips.push('Consider implementing virtualization');
      tips.push('Check for memory leaks in components');
    }
    
    return tips;
  }, [metrics]);

  return {
    metrics,
    handleScroll,
    animatedScrollHandler,
    reportPerformance,
    optimizationTips,
    resetMetrics: () => {
      frameCount.current = 0;
      fpsHistory.current = [];
      scrollVelocityHistory.current = [];
      setMetrics({
        fps: 60,
        averageFps: 60,
        scrollDistance: 0,
        scrollVelocity: 0,
        frameDrops: 0,
        isScrolling: false,
      });
    },
  };
};

export default useScrollPerformance; 