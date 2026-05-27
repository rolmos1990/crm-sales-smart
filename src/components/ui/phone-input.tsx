"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

// ─── Catálogo de países ───────────────────────────────────────────────────────

export interface PhoneCountry {
  code: string;   // ISO alpha-2
  name: string;
  dial: string;   // "+507"
  flag: string;   // emoji flag
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  // LATAM primero
  { code: "PA", name: "Panamá",              dial: "+507",  flag: "🇵🇦" },
  { code: "PE", name: "Perú",                dial: "+51",   flag: "🇵🇪" },
  { code: "CO", name: "Colombia",            dial: "+57",   flag: "🇨🇴" },
  { code: "MX", name: "México",              dial: "+52",   flag: "🇲🇽" },
  { code: "AR", name: "Argentina",           dial: "+54",   flag: "🇦🇷" },
  { code: "CL", name: "Chile",               dial: "+56",   flag: "🇨🇱" },
  { code: "EC", name: "Ecuador",             dial: "+593",  flag: "🇪🇨" },
  { code: "BO", name: "Bolivia",             dial: "+591",  flag: "🇧🇴" },
  { code: "VE", name: "Venezuela",           dial: "+58",   flag: "🇻🇪" },
  { code: "PY", name: "Paraguay",            dial: "+595",  flag: "🇵🇾" },
  { code: "UY", name: "Uruguay",             dial: "+598",  flag: "🇺🇾" },
  { code: "CR", name: "Costa Rica",          dial: "+506",  flag: "🇨🇷" },
  { code: "GT", name: "Guatemala",           dial: "+502",  flag: "🇬🇹" },
  { code: "HN", name: "Honduras",            dial: "+504",  flag: "🇭🇳" },
  { code: "SV", name: "El Salvador",         dial: "+503",  flag: "🇸🇻" },
  { code: "NI", name: "Nicaragua",           dial: "+505",  flag: "🇳🇮" },
  { code: "DO", name: "Rep. Dominicana",     dial: "+1",    flag: "🇩🇴" },
  { code: "CU", name: "Cuba",                dial: "+53",   flag: "🇨🇺" },
  { code: "PR", name: "Puerto Rico",         dial: "+1",    flag: "🇵🇷" },
  // Resto del mundo
  { code: "US", name: "Estados Unidos",      dial: "+1",    flag: "🇺🇸" },
  { code: "CA", name: "Canadá",              dial: "+1",    flag: "🇨🇦" },
  { code: "BR", name: "Brasil",              dial: "+55",   flag: "🇧🇷" },
  { code: "ES", name: "España",              dial: "+34",   flag: "🇪🇸" },
  { code: "PT", name: "Portugal",            dial: "+351",  flag: "🇵🇹" },
  { code: "GB", name: "Reino Unido",         dial: "+44",   flag: "🇬🇧" },
  { code: "DE", name: "Alemania",            dial: "+49",   flag: "🇩🇪" },
  { code: "FR", name: "Francia",             dial: "+33",   flag: "🇫🇷" },
  { code: "IT", name: "Italia",              dial: "+39",   flag: "🇮🇹" },
  { code: "AU", name: "Australia",           dial: "+61",   flag: "🇦🇺" },
  { code: "JP", name: "Japón",               dial: "+81",   flag: "🇯🇵" },
  { code: "CN", name: "China",               dial: "+86",   flag: "🇨🇳" },
  { code: "IN", name: "India",               dial: "+91",   flag: "🇮🇳" },
];

// Ordena dial codes de mayor a menor longitud para el parsing ("+593" antes de "+59")
const SORTED_BY_DIAL = [...PHONE_COUNTRIES].sort(
  (a, b) => b.dial.length - a.dial.length
);

// ─── Utilidades de parsing ────────────────────────────────────────────────────

function parsePhone(
  raw: string,
  fallbackCode: string
): { countryCode: string; local: string } {
  const val = raw?.trim() ?? "";

  if (val.startsWith("+")) {
    for (const c of SORTED_BY_DIAL) {
      if (val.startsWith(c.dial)) {
        return {
          countryCode: c.code,
          local: val.slice(c.dial.length).trim(),
        };
      }
    }
  }

  // Sin prefijo → mantener valor como local con el país por defecto
  return { countryCode: fallbackCode, local: val };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhoneInputProps {
  value?: string;
  onChange: (value: string) => void;
  /** ISO alpha-2 que se aplica cuando el campo está vacío y cambia el país */
  defaultCountryCode?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function PhoneInput({
  value = "",
  onChange,
  defaultCountryCode = "PE",
  disabled = false,
  placeholder = "000 000 0000",
  className,
}: PhoneInputProps) {
  const initialParsed = parsePhone(value, defaultCountryCode);
  const [countryCode, setCountryCode] = useState(initialParsed.countryCode);
  const [local, setLocal] = useState(initialParsed.local);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cuando el defaultCountryCode cambia (por cambio de País) y el campo está vacío,
  // actualizar automáticamente el prefijo sugerido
  useEffect(() => {
    if (!local) {
      setCountryCode(defaultCountryCode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCountryCode]);

  // Sincronizar si el value prop cambia externamente (ej: reset del form)
  useEffect(() => {
    const parsed = parsePhone(value, defaultCountryCode);
    setCountryCode(parsed.countryCode);
    setLocal(parsed.local);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const emit = (code: string, number: string) => {
    const country = PHONE_COUNTRIES.find((c) => c.code === code);
    if (!country) return;
    const combined = number.trim() ? `${country.dial} ${number.trim()}` : "";
    onChange(combined);
  };

  const handleSelectCountry = (code: string) => {
    setCountryCode(code);
    setOpen(false);
    emit(code, local);
    // Foco al input de número
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleLocalChange = (num: string) => {
    // Solo permitir dígitos, espacios, guiones y paréntesis
    const cleaned = num.replace(/[^\d\s\-()]/g, "");
    setLocal(cleaned);
    emit(countryCode, cleaned);
  };

  const selected = PHONE_COUNTRIES.find((c) => c.code === countryCode) ?? PHONE_COUNTRIES[0];

  return (
    <div className={cn("flex h-9", className)}>
      {/* ── Selector de país ── */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex items-center gap-1.5 px-3 h-9 rounded-l-xl border border-r-0",
            "border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5",
            "text-stone-700 dark:text-stone-300 text-sm",
            "hover:bg-stone-100 dark:hover:bg-white/8 transition-colors",
            "focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:ring-inset",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex-shrink-0 min-w-[90px]"
          )}
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-mono text-xs text-stone-500 dark:text-stone-400">
            {selected.dial}
          </span>
          <ChevronDown className="h-3 w-3 text-stone-400 flex-shrink-0" />
        </PopoverTrigger>

        <PopoverContent align="start" side="bottom" className="p-0 w-72">
          <Command>
            <CommandInput placeholder="Buscar país o código..." />
            <CommandList>
              <CommandEmpty>Sin resultados</CommandEmpty>
              <CommandGroup>
                {PHONE_COUNTRIES.map((country) => (
                  <CommandItem
                    key={`${country.code}-${country.dial}`}
                    value={`${country.name} ${country.dial} ${country.code}`}
                    onSelect={() => handleSelectCountry(country.code)}
                    data-checked={countryCode === country.code}
                    className="gap-2.5"
                  >
                    <span className="text-base w-6 flex-shrink-0">{country.flag}</span>
                    <span className="flex-1 truncate">{country.name}</span>
                    <span className="text-xs font-mono text-stone-400 dark:text-stone-500 flex-shrink-0">
                      {country.dial}
                    </span>
                    {countryCode === country.code && (
                      <Check className="h-3.5 w-3.5 text-lime-500 flex-shrink-0" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* ── Input del número ── */}
      <input
        ref={inputRef}
        type="tel"
        value={local}
        onChange={(e) => handleLocalChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn(
          "flex-1 h-9 rounded-r-xl border",
          "border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-white/5",
          "px-3 text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400",
          "focus:outline-none focus:ring-2 focus:ring-lime-500/30 focus:border-lime-500/50",
          "transition-all disabled:opacity-50"
        )}
      />
    </div>
  );
}
