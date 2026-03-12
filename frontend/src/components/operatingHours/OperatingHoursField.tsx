import React, { useMemo, useState } from 'react';
import OperatingHoursModal from './OperatingHoursModal';
import { OperatingHoursData, WEEK_DAYS } from './operatingHoursTypes';

type Props = {
  value: OperatingHoursData;
  onChange: (next: OperatingHoursData) => void;
  error?: string;
};

const OperatingHoursField = ({ value, onChange, error }: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const summary = useMemo(() => {
    const enabledDays = WEEK_DAYS.filter(day => value.days[day.key].enabled);
    if (value.allDays && value.startTime && value.endTime) {
      if (enabledDays.length === WEEK_DAYS.length) {
        return `All days: ${value.startTime} - ${value.endTime}`;
      }
      if (enabledDays.length) {
        return `${enabledDays.length} day(s): ${value.startTime} - ${value.endTime}`;
      }
    }
    if (!enabledDays.length) {
      return 'No operating hours set';
    }
    const label = enabledDays.map(day => day.label).join(', ');
    return `${enabledDays.length} day(s) selected: ${label}`;
  }, [value]);

  return (
    <div className="operating-hours-field">
      <div className="operating-hours-summary">
        <div>
          <div className="summary-label">Operating Hours</div>
          <div className="summary-text">{summary}</div>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setIsOpen(true)}
        >
          Set Hours
        </button>
      </div>
      {error && <span className="error">{error}</span>}

      <OperatingHoursModal
        isOpen={isOpen}
        value={value}
        onChange={onChange}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
};

export default OperatingHoursField;
