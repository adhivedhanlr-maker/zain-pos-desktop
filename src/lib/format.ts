// Indian currency formatting utility
export function formatIndianCurrency(amount: number): string {
    // Format as Indian numbering system: 12,34,567.89
    const isNegative = amount < 0;
    const absAmount = Math.abs(amount);

    const [integerPart, decimalPart] = absAmount.toFixed(2).split('.');

    // Indian numbering: last 3 digits, then groups of 2
    let formatted = '';
    const len = integerPart.length;

    if (len <= 3) {
        formatted = integerPart;
    } else {
        // Last 3 digits
        formatted = integerPart.slice(len - 3);
        let remaining = integerPart.slice(0, len - 3);

        // Groups of 2 from right to left
        while (remaining.length > 0) {
            if (remaining.length <= 2) {
                formatted = remaining + ',' + formatted;
                remaining = '';
            } else {
                formatted = remaining.slice(remaining.length - 2) + ',' + formatted;
                remaining = remaining.slice(0, remaining.length - 2);
            }
        }
    }

    const result = `₹${formatted}.${decimalPart}`;
    return isNegative ? `-${result}` : result;
}

// Calculate percentage change
export function calculatePercentageChange(current: number, previous: number): {
    percentage: number;
    isIncrease: boolean;
    display: string;
} {
    if (previous === 0) {
        return {
            percentage: current > 0 ? 100 : 0,
            isIncrease: current > 0,
            display: current > 0 ? '+100%' : '0%'
        };
    }

    const change = ((current - previous) / previous) * 100;
    const isIncrease = change >= 0;
    const display = `${isIncrease ? '+' : ''}${change.toFixed(1)}%`;

    return {
        percentage: Math.abs(change),
        isIncrease,
        display
    };
}
