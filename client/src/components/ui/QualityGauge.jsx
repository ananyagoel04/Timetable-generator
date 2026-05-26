import { useMemo } from 'react';

/**
 * Animated radial gauge component for quality scores.
 * @param {Object} props
 * @param {number} props.value - Score 0-100
 * @param {string} props.label - Center label
 * @param {number} props.size - SVG size in px (default 160)
 */
export default function QualityGauge({ value = 0, label = 'Quality', size = 160 }) {
  const { color, bgColor, textColor } = useMemo(() => {
    if (value >= 80) return {
      color: '#10b981', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30',
      textColor: 'text-emerald-600 dark:text-emerald-400'
    };
    if (value >= 60) return {
      color: '#f59e0b', bgColor: 'bg-amber-50 dark:bg-amber-950/30',
      textColor: 'text-amber-600 dark:text-amber-400'
    };
    if (value >= 40) return {
      color: '#f97316', bgColor: 'bg-orange-50 dark:bg-orange-950/30',
      textColor: 'text-orange-600 dark:text-orange-400'
    };
    return {
      color: '#ef4444', bgColor: 'bg-red-50 dark:bg-red-950/30',
      textColor: 'text-red-600 dark:text-red-400'
    };
  }, [value]);

  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (value / 100) * circumference;
  const center = size / 2;

  return (
    <div className={`inline-flex flex-col items-center justify-center p-4 rounded-xl ${bgColor}`}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" strokeWidth="10"
          className="stroke-slate-200 dark:stroke-dark-700"
        />
        {/* Progress arc */}
        <circle
          cx={center} cy={center} r={radius}
          fill="none" strokeWidth="10"
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          style={{
            transition: 'stroke-dashoffset 1s ease-out',
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center" style={{ marginTop: -size/2 - 10 + size/2 }}>
        <span className={`text-3xl font-bold ${textColor}`} style={{ position: 'relative', top: `-${size/2+16}px` }}>
          {value}
        </span>
      </div>
      <p className="text-xs text-slate-500 dark:text-dark-400 mt-1 font-medium">{label}</p>
    </div>
  );
}
