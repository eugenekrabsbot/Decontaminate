export default function Card({
  children,
  title,
  subtitle,
  style = {},
  padding = '1.5rem',
  ...props
}) {
  const cardStyle = {
    backgroundColor: '#2A2A2A',
    border: '1px solid #444',
    borderRadius: '8px',
    padding,
    transition: 'all 0.3s ease',
    ...style,
  };

  return (
    <div style={cardStyle} {...props}>
      {title && (
        <h3 style={{ color: '#1E90FF', marginBottom: '0.5rem', fontSize: '1.1rem' }}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p style={{ color: '#B0C4DE', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {subtitle}
        </p>
      )}
      {children}
    </div>
  );
}
