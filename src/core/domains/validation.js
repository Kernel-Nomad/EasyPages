import { isValidDomainName as isValidDomainNameUtil } from '../../utils/validation.js';

export const normalizeDomainName = (name) => {
  if (typeof name !== 'string') {
    return '';
  }
  return name.trim().toLowerCase();
};

export const isValidDomainName = (name) => isValidDomainNameUtil(name);
