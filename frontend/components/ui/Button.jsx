export default function Button({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'md',
  type = 'button',
  style = {},
  className = '',
  ...props
}) {
  const variants = {
    primary: {
      backgroundColor: '#1E90FF',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '4px',
      fontWeight: 600,
    },
    secondary: {
      backgroundColor: 'transparent',
      color: '#1E90FF',
      border: '1px solid #1E90FF',
      borderRadius: '4px',
      fontWeight: 600,
    },
    danger: {
      backgroundColor: '#FF6B6B',
      color: '#FFFFFF',
      border: 'none',
      borderRadius: '4px',
      fontWeight: 600,
    },
  };

  const sizes = {
    sm: { padding: '0.4rem 0.8rem', fontSize: '0.85rem' },
    md: { padding: '0.6rem 1.2rem', fontSize: '0.95rem' },
    lg: { padding: '0.8rem 1.6rem', fontSize: '1rem' },
  };

  const baseStyle = {
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    transition: 'all 0.3s ease',
    ...variants[variant],
    ...sizes[size],
    ...style,
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={baseStyle}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.target.style.backgroundColor = variant === 'primary' ? '#20B2AA' : '#00BFFF';
        }
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = variants[variant].backgroundColor;
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}
