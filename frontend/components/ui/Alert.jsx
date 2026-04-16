export default function Alert({
  type = 'info', // info, success, warning, error
  title,
  message,
  onClose,
  dismissible = true,
  style = {},
}) {
  const typeStyles = {
    info: {
      backgroundColor: 'rgba(30, 144, 255, 0.1)',
      borderColor: '#1E90FF',
      titleColor: '#1E90FF',
      messageColor: '#B0C4DE',
    },
    success: {
      backgroundColor: 'rgba(0, 206, 209, 0.1)',
      borderColor: '#00CED1',
      titleColor: '#00CED1',
      messageColor: '#B0C4DE',
    },
    warning: {
      backgroundColor: 'rgba(255, 217, 61, 0.1)',
      borderColor: '#FFD93D',
      titleColor: '#FFD93D',
      messageColor: '#B0C4DE',
    },
    error: {
      backgroundColor: 'rgba(255, 107, 107, 0.1)',
      borderColor: '#FF6B6B',
      titleColor: '#FF6B6B',
      messageColor: '#B0C4DE',
    },
  };

  const current = typeStyles[type] || typeStyles.info;
  const icons = {
    info: 'ℹ️',
    success: '✓',
    warning: '⚠️',
    error: '✕',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '1rem',
        padding: '1rem',
        backgroundColor: current.backgroundColor,
        border: `1px solid ${current.borderColor}`,
        borderRadius: '4px',
        marginBottom: '1rem',
        ...style,
      }}
      role="alert"
    >
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>
        {icons[type]}
      </span>

      <div style={{ flex: 1 }}>
        {title && (
          <p
            style={{
              color: current.titleColor,
              fontWeight: 600,
              marginBottom: '0.25rem',
            }}
          >
            {title}
          </p>
        )}
        <p style={{ color: current.messageColor, fontSize: '0.95rem' }}>
          {message}
        </p>
      </div>

      {dismissible && onClose && (
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: current.titleColor,
            cursor: 'pointer',
            fontSize: '1.5rem',
            padding: 0,
            flexShrink: 0,
          }}
          aria-label="Close alert"
        >
          ×
        </button>
      )}
    </div>
  );
}
