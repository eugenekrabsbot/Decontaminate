export default function Form({
  children,
  onSubmit,
  style = {},
  ...props
}) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSubmit) onSubmit(e);
  };

  return (
    <form onSubmit={handleSubmit} style={formStyle} {...props}>
      {children}
    </form>
  );
}

export function FormGroup({
  label,
  error,
  children,
  style = {},
}) {
  return (
    <div style={{ marginBottom: '1.5rem', ...style }}>
      {label && (
        <label style={{ color: '#F0F4F8', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <p style={{ color: '#FF6B6B', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  disabled = false,
  error = false,
  style = {},
  ...props
}) {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '0.75rem',
        backgroundColor: '#252525',
        color: '#F0F4F8',
        border: error ? '1px solid #FF6B6B' : '1px solid #3A3A3A',
        borderRadius: '4px',
        fontSize: '1rem',
        transition: 'border-color 0.3s ease',
        ...style,
      }}
      {...props}
    />
  );
}

export function Select({
  value,
  onChange,
  children,
  error = false,
  style = {},
  ...props
}) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: '100%',
        padding: '0.75rem',
        backgroundColor: '#252525',
        color: '#F0F4F8',
        border: error ? '1px solid #FF6B6B' : '1px solid #3A3A3A',
        borderRadius: '4px',
        fontSize: '1rem',
        transition: 'border-color 0.3s ease',
        cursor: 'pointer',
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
}

const formStyle = {
  width: '100%',
};
