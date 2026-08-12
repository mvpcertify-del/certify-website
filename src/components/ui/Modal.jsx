import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import './Modal.css';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  // True only while a click gesture that BEGAN on the backdrop is in flight.
  //
  // Why this exists (client, 12 Aug: "when registering as Add Auditor, in case
  // I want to use copy paste information, always the Form is exiting & I have
  // to start again. This issue happened 5 times"):
  //
  // A `click` fires on the nearest common ancestor of where the mouse went
  // DOWN and where it came UP. Select the text in a field to copy or replace
  // it, drag a few pixels past the edge of the dialog, and release — down
  // inside the dialog, up on the backdrop, so the click lands on the backdrop
  // itself and the dialog's own stopPropagation never sees it. The old
  // `onClick={onClose}` then closed the form and threw away everything typed.
  // Selecting text is exactly what someone doing copy/paste does constantly,
  // which is why it kept happening to them and not to anyone else.
  //
  // The fix is to close only when the gesture started on the backdrop too — a
  // deliberate click outside the dialog. Clicking outside still closes it;
  // dragging out of it no longer does.
  const pressedBackdrop = useRef(false);
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { pressedBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;   // came from inside the dialog
        if (!pressedBackdrop.current) return;       // drag that started inside it
        pressedBackdrop.current = false;
        onClose();
      }}
    >
      <div className={`modal modal--${size}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">{title}</h2>
          <button className="modal__close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal__content">
          {children}
        </div>
      </div>
    </div>
  );
}
