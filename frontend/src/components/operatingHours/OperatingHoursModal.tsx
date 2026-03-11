import React from 'react';
import {
  OperatingHoursData,
  WEEK_DAYS,
  WeekDayKey,
} from './operatingHoursTypes';

type Props = {
  isOpen: boolean;
  value: OperatingHoursData;
  onChange: (next: OperatingHoursData) => void;
  onClose: () => void;
};

const OperatingHoursModal = ({ isOpen, value, onChange, onClose }: Props) => {
  if (!isOpen) return null;

  const update = (next: OperatingHoursData) => onChange(next);

  const handleAllDaysToggle = (checked: boolean) => {
    const nextDays = { ...value.days };
    if (checked) {
      WEEK_DAYS.forEach(day => {
        nextDays[day.key] = { ...nextDays[day.key], enabled: true };
      });
    }

    update({
      ...value,
      allDays: checked,
      days: nextDays
    });
  };

  const handleDayToggle = (dayKey: WeekDayKey, checked: boolean) => {
    update({
      ...value,
      allDays: false,
      days: {
        ...value.days,
        [dayKey]: {
          ...value.days[dayKey],
          enabled: checked
        }
      }
    });
  };

  const handleAllDaysTimeChange = (field: 'startTime' | 'endTime', input: string) => {
    update({
      ...value,
      [field]: input
    });
  };

  const handleDayTimeChange = (
    dayKey: WeekDayKey,
    field: 'start' | 'end',
    input: string
  ) => {
    update({
      ...value,
      days: {
        ...value.days,
        [dayKey]: {
          ...value.days[dayKey],
          [field]: input
        }
      }
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-header">
          <h4>Operating Hours</h4>
          <button type="button" className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <label className="checkbox-label small">
            <input
              type="checkbox"
              checked={value.allDays}
              onChange={(e) => handleAllDaysToggle(e.target.checked)}
            />
            <span>Select all days</span>
          </label>

          <div className="days-grid">
            {WEEK_DAYS.map((day) => (
              <label
                key={day.key}
                className={`day-chip ${value.days[day.key].enabled ? 'active' : ''} ${value.allDays ? 'disabled' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={value.days[day.key].enabled}
                  disabled={value.allDays}
                  onChange={(e) => handleDayToggle(day.key, e.target.checked)}
                />
                <span>{day.label}</span>
              </label>
            ))}
          </div>

          {value.allDays ? (
            <div className="time-row">
              <div className="time-field">
                <label>Start Time</label>
                <input
                  type="time"
                  value={value.startTime}
                  onChange={(e) => handleAllDaysTimeChange('startTime', e.target.value)}
                />
              </div>
              <div className="time-field">
                <label>End Time</label>
                <input
                  type="time"
                  value={value.endTime}
                  onChange={(e) => handleAllDaysTimeChange('endTime', e.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="day-time-list">
              {WEEK_DAYS.filter(day => value.days[day.key].enabled).map((day) => (
                <div key={day.key} className="day-time-row">
                  <span className="day-label">{day.full}</span>
                  <input
                    type="time"
                    value={value.days[day.key].start}
                    onChange={(e) => handleDayTimeChange(day.key, 'start', e.target.value)}
                  />
                  <input
                    type="time"
                    value={value.days[day.key].end}
                    onChange={(e) => handleDayTimeChange(day.key, 'end', e.target.value)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="submit-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default OperatingHoursModal;
