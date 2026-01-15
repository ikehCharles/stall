import { formatCurrency, getCurrencySymbol } from '@/lib/utils';
import React, { useMemo } from 'react';
interface CurrencyWrapperProps {
    amount?: number; // Make amount optional
    currency?: string;
}

const CurrencyWrapper: React.FC<CurrencyWrapperProps> = ({ amount, currency = 'GBP' }) => {
    const displayValue = useMemo(() => {
        return amount !== undefined ? formatCurrency(amount, currency) : getCurrencySymbol(currency);
    }, [amount, currency]);

    return <span>{displayValue}</span>;
};

export default CurrencyWrapper;
