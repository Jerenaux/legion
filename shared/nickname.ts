import {RegExpMatcher, englishDataset, englishRecommendedTransformers} from 'obscenity';
import {MAX_NICKNAME_LENGTH} from './config';

let matcher: RegExpMatcher;

/** Normalize and enforce the same nickname rules at both ends of the request. */
export function validateNickname(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Choose a name.');
  const name = value.trim();
  if (name.length > MAX_NICKNAME_LENGTH) throw new Error('Name is too long.');
  matcher ??= new RegExpMatcher({...englishDataset.build(), ...englishRecommendedTransformers});
  if (matcher.hasMatch(name)) throw new Error('Name contains profane words');
  return name;
}
