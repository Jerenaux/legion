import {t} from '../../i18n/core';
import { h } from 'preact';

import './Spinner.style.css';

const Spinner = () => (
  <div className="spinner" role="status">
    <span className="visually-hidden">{t("Loading...")}</span>
  </div>
);

export default Spinner;