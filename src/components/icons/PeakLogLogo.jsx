import PeakLogIcon from './PeakLogIcon';

const PeakLogLogo = ({ size = "default", className = "", showText = true, iconOnly = false }) => {
  const sizes = {
    sm: { icon: 24, text: "text-lg" },
    default: { icon: 32, text: "text-xl" },
    lg: { icon: 48, text: "text-2xl" },
    xl: { icon: 64, text: "text-3xl" }
  };

  const currentSize = sizes[size] || sizes.default;

  if (iconOnly) {
    return <PeakLogIcon size={currentSize.icon} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <PeakLogIcon size={currentSize.icon} />
      {showText && (
        <span className={`font-bold text-slate-800 ${currentSize.text}`}>
          PeakLog
        </span>
      )}
    </div>
  );
};

export default PeakLogLogo;