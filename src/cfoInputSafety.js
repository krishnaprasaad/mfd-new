const OTP_LABEL = String.raw`(?:\botp\b|\bone[-\s]?time password\b|\bverification code\b)`;
const OTP_VALUE = String.raw`\b\d(?:[\s-]?\d){3,7}\b`;

const otpWithValue = new RegExp(
    `(?:${OTP_LABEL}[\\s\\S]{0,40}${OTP_VALUE}|${OTP_VALUE}[\\s\\S]{0,40}${OTP_LABEL})`,
    'i'
);

export const containsOtpSecret = value => otpWithValue.test(String(value || ''));

