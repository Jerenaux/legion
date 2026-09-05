import { h } from "preact";
import "./Spinner.style.css";

const Spinner = () => (
  <div className="spinner" role="status">
    <span className="visually-hidden">Loading...</span>
  </div>
);

export default Spinner;
