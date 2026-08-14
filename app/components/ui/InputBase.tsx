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
  compact?: boolean;
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
  compact = false,
  ...rest
}) => {
  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
        {label}
        {labelOptional ? <span className="text-gray-400 normal-case font-normal">{labelOptional}</span> : <span className="text-rose-500">*</span>}
      </label>

      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full px-4 ${compact ? "py-1.5" : "py-2"} bg-gray-50 border border-gray-200 rounded-xl outline-none focus:border-brand-blue/50 ${
          type === "number"
            ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            : ""
        } ${className}`}
        maxLength={maxLength}
        pattern={pattern}
        disabled={disabled}
        readOnly={readOnly}
        onFocus={(e) => {
          if (type === "number" || value === "0" || value === "0.00" || value === "0.0") {
            e.currentTarget.select();
          }
          rest.onFocus?.(e);
        }}
        onClick={(e) => {
          const val = (e.target as HTMLInputElement).value;
          if (type === "number" || val === "0" || val === "0.00" || val === "0.0") {
            (e.target as HTMLInputElement).select();
          }
          rest.onClick?.(e);
        }}
        // Evita que la rueda del mouse cambie el valor al pasar por encima de un input numérico.
        onWheel={type === "number" ? (e) => e.currentTarget.blur() : undefined}
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