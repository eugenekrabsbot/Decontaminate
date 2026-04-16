export default function Spinner({ size = 'md', text = 'Loading...' }) {
  const sizes = {
    sm: { width: '20px', height: '20px', fontSize: '0.8rem' },
    md: { width: '40px', height: '40px', fontSize: '1rem' },
    lg: { width: '60px', height: '60px', fontSize: '1.1rem' },
  };

  const sizeStyle = sizes[size] || sizes.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        padding: '2rem',
      }}
    >
      <div
        style={{
          ...sizeStyle,
          border: '3px solid #3A3A3A',
          borderTop: '3px solid #1E90FF',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {text && (
        <p style={{ color: '#B0C4DE', fontSize: sizeStyle.fontSize }}>
          {text}
        </p>
      )}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export function SkeletonText({ lines = 3, style = {} }) {
  return (
    <div style={style}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            height: '1rem',
            backgroundColor: '#3A3A3A',
            borderRadius: '4px',
            marginBottom: '0.75rem',
            animation: 'pulse 2s ease-in-out infinite',
            opacity: 0.6,
          }}
        />
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export function SkeletonCard({ style = {} }) {
  return (
    <div
      style={{
        backgroundColor: '#252525',
        border: '1px solid #3A3A3A',
        borderRadius: '8px',
        padding: '1.5rem',
        ...style,
      }}
    >
      <div
        style={{
          height: '1.5rem',
          backgroundColor: '#3A3A3A',
          borderRadius: '4px',
          marginBottom: '1rem',
          animation: 'pulse 2s ease-in-out infinite',
          opacity: 0.6,
        }}
      />
      <SkeletonText lines={3} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
