interface InputBaseProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  labelOptional?: string;
  required?: boolean;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showError?: boolean;
  errorMessage?: string;
  className?: string;
  maxLength?: number;
  pattern?: string;
  disabled?: boolean;
  readOnly?: boolean;
}

export const InputBase: React.FC<InputBaseProps> = ({
  label,
  labelOptional = '',
  required = false,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  className = '',
  maxLength,
  pattern,
  disabled,
  readOnly,
  showError = false,
  errorMessage,
  ...rest
}) => {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
        {label}
        {labelOptional ? <span className="text-gray-400 normal-case font-normal">{labelOptional}</span> : <span className="text-rose-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 ${className}`}
        maxLength={maxLength}
        pattern={pattern}
        disabled={disabled}
        readOnly={readOnly}
        {...rest}
      />

      {/* Mensaje de error solo si showError es true */}
      {showError && (
        <p className="text-xs text-rose-500 font-medium">
          {errorMessage || "Campo obligatorio"}
        </p>
      )}
    </div>
  );
};