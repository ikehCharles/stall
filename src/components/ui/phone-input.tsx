import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { parsePhoneNumber, getCountries, getCountryCallingCode, AsYouType, isValidPhoneNumber } from 'libphonenumber-js';

interface Country {
  code: string;
  name: string;
  callingCode: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'US', name: 'United States', callingCode: '1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', callingCode: '44', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada', callingCode: '1', flag: '🇨🇦' },
  { code: 'AU', name: 'Australia', callingCode: '61', flag: '🇦🇺' },
  { code: 'DE', name: 'Germany', callingCode: '49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', callingCode: '33', flag: '🇫🇷' },
  { code: 'IT', name: 'Italy', callingCode: '39', flag: '🇮🇹' },
  { code: 'ES', name: 'Spain', callingCode: '34', flag: '🇪🇸' },
  { code: 'NL', name: 'Netherlands', callingCode: '31', flag: '🇳🇱' },
  { code: 'BE', name: 'Belgium', callingCode: '32', flag: '🇧🇪' },
  { code: 'CH', name: 'Switzerland', callingCode: '41', flag: '🇨🇭' },
  { code: 'AT', name: 'Austria', callingCode: '43', flag: '🇦🇹' },
  { code: 'SE', name: 'Sweden', callingCode: '46', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', callingCode: '47', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', callingCode: '45', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', callingCode: '358', flag: '🇫🇮' },
  { code: 'JP', name: 'Japan', callingCode: '81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', callingCode: '82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', callingCode: '86', flag: '🇨🇳' },
  { code: 'IN', name: 'India', callingCode: '91', flag: '🇮🇳' },
  { code: 'SG', name: 'Singapore', callingCode: '65', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', callingCode: '852', flag: '🇭🇰' },
  { code: 'TW', name: 'Taiwan', callingCode: '886', flag: '🇹🇼' },
  { code: 'MY', name: 'Malaysia', callingCode: '60', flag: '🇲🇾' },
  { code: 'TH', name: 'Thailand', callingCode: '66', flag: '🇹🇭' },
  { code: 'ID', name: 'Indonesia', callingCode: '62', flag: '🇮🇩' },
  { code: 'PH', name: 'Philippines', callingCode: '63', flag: '🇵🇭' },
  { code: 'VN', name: 'Vietnam', callingCode: '84', flag: '🇻🇳' },
  { code: 'NG', name: 'Nigeria', callingCode: '234', flag: '🇳🇬' },
  { code: 'ZA', name: 'South Africa', callingCode: '27', flag: '🇿🇦' },
  { code: 'EG', name: 'Egypt', callingCode: '20', flag: '🇪🇬' },
  { code: 'KE', name: 'Kenya', callingCode: '254', flag: '🇰🇪' },
  { code: 'GH', name: 'Ghana', callingCode: '233', flag: '🇬🇭' },
  { code: 'BR', name: 'Brazil', callingCode: '55', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', callingCode: '54', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', callingCode: '56', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', callingCode: '57', flag: '🇨🇴' },
  { code: 'MX', name: 'Mexico', callingCode: '52', flag: '🇲🇽' },
  { code: 'PE', name: 'Peru', callingCode: '51', flag: '🇵🇪' },
];

interface PhoneInputProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  id?: string;
}

export const PhoneInput = ({ 
  value = "", 
  onChange, 
  placeholder, 
  disabled = false, 
  required = false,
  error,
  id 
}: PhoneInputProps) => {
  const [selectedCountry, setSelectedCountry] = useState<Country>(countries[0]);
  const [open, setOpen] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");

  // Parse initial value to extract country and number
  useEffect(() => {
    if (value && value.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed) {
          const country = countries.find(c => c.code === parsed.country);
          if (country) {
            setSelectedCountry(country);
            setPhoneNumber(parsed.nationalNumber);
            return;
          }
        }
      } catch (error) {
        console.error('Could not parse phone number:', value);
      }
    }
    
    // If we can't parse or no value, extract just the number part
    if (value && value.startsWith('+')) {
      const withoutPlus = value.slice(1);
      const countryMatch = countries.find(c => withoutPlus.startsWith(c.callingCode));
      if (countryMatch) {
        setSelectedCountry(countryMatch);
        setPhoneNumber(withoutPlus.slice(countryMatch.callingCode.length));
      }
    }
  }, [value]);

  const handlePhoneChange = (inputValue: string) => {
    // Only allow digits
    const digits = inputValue.replace(/\D/g, '');
    setPhoneNumber(digits);
    
    // Format and call onChange
    if (onChange) {
      const fullNumber = `+${selectedCountry.callingCode}${digits}`;
      onChange(fullNumber);
    }
  };

  const handleCountrySelect = (country: Country) => {
    setSelectedCountry(country);
    setOpen(false);
    
    // Update the full number with new country code
    if (onChange) {
      const fullNumber = `+${country.callingCode}${phoneNumber}`;
      onChange(fullNumber);
    }
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    
    // Generate example number for selected country
    const asYouType = new AsYouType(selectedCountry.code as any);
    const example = asYouType.input('1234567890');
    return example || 'Enter phone number';
  };

  const isValid = value ? isValidPhoneNumber(value) : true;

  return (
    <div className="space-y-2">
      <div className="flex">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "w-[140px] justify-between rounded-r-none border-r-0",
                error && "border-destructive",
                !isValid && "border-destructive"
              )}
              disabled={disabled}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="text-sm">+{selectedCountry.callingCode}</span>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <ScrollArea className="h-[200px]">
              <div className="p-1">
                {countries.map((country) => (
                  <Button
                    key={country.code}
                    variant="ghost"
                    className="w-full justify-start font-normal"
                    onClick={() => handleCountrySelect(country)}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <span className="text-lg">{country.flag}</span>
                      <span className="flex-1 text-left text-sm">{country.name}</span>
                      <span className="text-xs text-muted-foreground">+{country.callingCode}</span>
                      {selectedCountry.code === country.code && (
                        <Check className="h-4 w-4" />
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        
        <Input
          id={id}
          type="tel"
          placeholder={getPlaceholder()}
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          className={cn(
            "rounded-l-none flex-1",
            (error || !isValid) && "border-destructive"
          )}
          disabled={disabled}
          required={required}
        />
      </div>
      
      {(error || !isValid) && (
        <p className="text-sm text-destructive">
          {error || (!isValid && value ? "Please enter a valid phone number" : "")}
        </p>
      )}
    </div>
  );
};