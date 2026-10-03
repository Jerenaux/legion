import {i18n} from './core';
import {h} from 'preact';
import {Trans as I18nextTrans, type TransProps} from 'react-i18next';

// Parse only catalog markup. Player names stay text even when they contain tags.
export function Trans(props: TransProps<string>) {
  return <I18nextTrans i18n={i18n} {...props} shouldUnescape
    tOptions={{...props.tOptions, interpolation: {escapeValue: true}}} />;
}
