import type { ButtonHTMLAttributes, ElementType, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'border-0 bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] text-white shadow-[0_6px_20px_rgba(99,102,241,0.38)]',
  secondary: 'border-2 border-[#e5e7eb] bg-white text-[#374151] shadow-[0_2px_6px_rgba(0,0,0,0.06)]',
  destructive: 'border-[1.5px] border-[#fecaca] bg-[#fee2e2] text-[#dc2626] shadow-none',
  ghost: 'border-[1.5px] border-[#e5e7eb] bg-transparent text-[#6b7280] shadow-none',
};

type AppButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  label?: ReactNode;
  icon?: ElementType;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children?: ReactNode;
};

export function Button({ label, icon: Icon, variant = 'primary', fullWidth = true, disabled = false, className = '', children, type = 'button', ...props }: AppButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[var(--app-radius-xl)] px-5 py-3.5 text-[15px] font-semibold tracking-[0.01em] transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 ${fullWidth ? 'w-full' : 'w-auto'} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {Icon && <Icon className="h-[17px] w-[17px]" strokeWidth={2.5} />}
      {children ?? label}
    </button>
  );
}
