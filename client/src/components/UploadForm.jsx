import { useRef, useState } from 'react';

import { createContract } from '../services/api.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const SUPPORTED_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  txt: 'text/plain',
};

function getExtension(filename) {
  return filename.toLowerCase().split('.').pop();
}

function getFileType(file) {
  if (!file) {
    return null;
  }

  const extension = getExtension(file.name);

  return Object.prototype.hasOwnProperty.call(
    SUPPORTED_TYPES,
    extension,
  )
    ? extension
    : null;
}

function readFile(file, fileType) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onerror = () => {
      reject(
        new Error('The selected file could not be read.'),
      );
    };

    reader.onload = () => {
      try {
        const buffer = reader.result;

        if (fileType === 'txt') {
          const text = new TextDecoder().decode(
            new Uint8Array(buffer),
          );

          if (!text.trim()) {
            reject(
              new Error(
                'The selected text file is empty.',
              ),
            );
            return;
          }

          resolve({ text });
          return;
        }

        const bytes = new Uint8Array(buffer);
        let binary = '';

        const chunkSize = 0x8000;

        for (
          let index = 0;
          index < bytes.length;
          index += chunkSize
        ) {
          binary += String.fromCharCode(
            ...bytes.subarray(
              index,
              index + chunkSize,
            ),
          );
        }

        resolve({
          base64: btoa(binary),
        });
      } catch {
        reject(
          new Error(
            'The selected file could not be processed.',
          ),
        );
      }
    };

    reader.readAsArrayBuffer(file);
  });
}

function titleFromFilename(filename) {
  return filename.replace(/\.[^.]+$/, '').trim();
}

export default function UploadForm({ onSuccess }) {
  const inputRef = useRef(null);

  const [mode, setMode] = useState('file');

  const [title, setTitle] = useState('');
  const [text, setText] = useState('');

  const [selectedFile, setSelectedFile] = useState(null);

  const [state, setState] = useState('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  function changeMode(nextMode) {
    if (state === 'uploading') {
      return;
    }

    setMode(nextMode);
    setError('');
    setResult(null);
    setState('idle');

    if (nextMode === 'file') {
      setText('');
    } else {
      setSelectedFile(null);

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  }

  function selectFile(file) {
    setError('');
    setResult(null);

    if (!file) {
      setSelectedFile(null);
      setState('idle');
      return;
    }

    const fileType = getFileType(file);

    if (!fileType) {
      setSelectedFile(null);
      setState('error');
      setError(
        'Unsupported file type. Please choose a PDF, DOCX, or TXT file.',
      );
      return;
    }

    if (file.size === 0) {
      setSelectedFile(null);
      setState('error');
      setError('The selected file is empty.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null);
      setState('error');
      setError(
        'File is too large. Please choose a file smaller than 10 MB.',
      );
      return;
    }

    setSelectedFile(file);
    setState('idle');

    if (!title.trim()) {
      setTitle(titleFromFilename(file.name));
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (state === 'uploading') {
      return;
    }

    setError('');
    setResult(null);

    /*
     * FILE MODE
     */
    if (mode === 'file') {
      if (!selectedFile) {
        setState('error');
        setError(
          'Please select a PDF, DOCX, or TXT file.',
        );
        return;
      }

      const fileType = getFileType(selectedFile);

      if (!fileType) {
        setState('error');
        setError(
          'Unsupported file type. Please choose a PDF, DOCX, or TXT file.',
        );
        return;
      }

      if (selectedFile.size > MAX_FILE_SIZE) {
        setState('error');
        setError(
          'File is too large. Please choose a file smaller than 10 MB.',
        );
        return;
      }

      const contractTitle =
        title.trim() ||
        titleFromFilename(selectedFile.name);

      setState('uploading');

      try {
        const fileContents = await readFile(
          selectedFile,
          fileType,
        );

        const response = await createContract({
          title: contractTitle,
          fileType,
          ...fileContents,
        });

        if (
          !response?.contractId ||
          !response?.version
        ) {
          throw new Error(
            'The server returned an incomplete upload response.',
          );
        }

        setResult(response);
        setState('success');

        if (onSuccess) {
          onSuccess(response);
        }
      } catch (uploadError) {
        setState('error');
        setError(
          uploadError?.message ||
            'Upload failed. Please try again.',
        );
      }

      return;
    }

    /*
     * PASTE TEXT MODE
     */
    const trimmedText = text.trim();
    const contractTitle = title.trim();

    if (!contractTitle) {
      setState('error');
      setError(
        'Please enter a contract title when uploading pasted text.',
      );
      return;
    }

    if (!trimmedText) {
      setState('error');
      setError(
        'Please paste the contract text before uploading.',
      );
      return;
    }

    setState('uploading');

    try {
      const response = await createContract({
        title: contractTitle,
        fileType: 'txt',
        text: trimmedText,
      });

      if (
        !response?.contractId ||
        !response?.version
      ) {
        throw new Error(
          'The server returned an incomplete upload response.',
        );
      }

      setResult(response);
      setState('success');

      if (onSuccess) {
        onSuccess(response);
      }
    } catch (uploadError) {
      setState('error');
      setError(
        uploadError?.message ||
          'Upload failed. Please try again.',
      );
    }
  }

  function retry() {
    setError('');
    setState('idle');
    setResult(null);
  }

  return (
    <form
      className="card upload-form"
      onSubmit={handleSubmit}
    >
      <div>
        <p className="eyebrow">New contract</p>

        <h2>Upload Contract</h2>

        <p className="muted">
          Upload a text-based PDF, DOCX, TXT contract,
          or paste contract text for extraction and
          review.
        </p>
      </div>

      <div className="upload-mode-switch">
        <button
          type="button"
          className={
            mode === 'file'
              ? 'mode-button active'
              : 'mode-button'
          }
          onClick={() => changeMode('file')}
          disabled={state === 'uploading'}
        >
          Upload File
        </button>

        <button
          type="button"
          className={
            mode === 'text'
              ? 'mode-button active'
              : 'mode-button'
          }
          onClick={() => changeMode('text')}
          disabled={state === 'uploading'}
        >
          Paste Text
        </button>
      </div>

      <label>
        Contract title

        <span className="label-hint">
          {mode === 'file'
            ? 'Optional — filename will be used if empty.'
            : 'Required when pasting contract text.'}
        </span>

        <input
          type="text"
          value={title}
          onChange={(event) =>
            setTitle(event.target.value)
          }
          placeholder="e.g. Acme Supplier Agreement"
          disabled={state === 'uploading'}
        />
      </label>

      {mode === 'file' ? (
        <>
          <label>
            Contract file

            <span className="label-hint">
              PDF, DOCX or TXT · Maximum 10 MB
            </span>

            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              onChange={(event) =>
                selectFile(
                  event.target.files?.[0] || null,
                )
              }
              disabled={state === 'uploading'}
            />
          </label>

          {selectedFile ? (
            <div className="selected-file">
              <strong>Selected file</strong>

              <span>{selectedFile.name}</span>

              <span className="muted">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </span>
            </div>
          ) : null}
        </>
      ) : (
        <label>
          Contract text

          <span className="label-hint">
            Paste the text of your contract below.
          </span>

          <textarea
            value={text}
            onChange={(event) =>
              setText(event.target.value)
            }
            placeholder="Paste your contract text here..."
            rows={16}
            disabled={state === 'uploading'}
          />
        </label>
      )}

      {error ? (
        <div
          className="form-error"
          role="alert"
        >
          <strong>Upload failed</strong>
          <p>{error}</p>
        </div>
      ) : null}

      <div className="upload-actions">
        <button
          type="submit"
          disabled={
            state === 'uploading' ||
            (mode === 'file' && !selectedFile) ||
            (mode === 'text' &&
              (!title.trim() || !text.trim()))
          }
        >
          {state === 'uploading'
            ? 'Uploading and processing…'
            : mode === 'file'
              ? 'Upload contract'
              : 'Upload text'}
        </button>

        {state === 'error' ? (
          <button
            type="button"
            className="secondary-button"
            onClick={retry}
            disabled={state === 'uploading'}
          >
            Retry
          </button>
        ) : null}
      </div>

      {state === 'uploading' ? (
        <div
          className="upload-progress"
          role="status"
        >
          <span className="spinner" />

          <div>
            <strong>
              Processing contract…
            </strong>

            <p className="muted">
              The backend is extracting contract
              information. This may take a moment.
            </p>
          </div>
        </div>
      ) : null}

      {state === 'success' && result ? (
        <div
          className="success-box"
          role="status"
        >
          <strong>
            Contract created successfully.
          </strong>

          <p>
            Version{' '}
            {result.version.versionNo} is ready
            for review.
          </p>

          <a
            className="button-link"
            href={`/contracts/${result.contractId}`}
          >
            Open contract dashboard
          </a>
        </div>
      ) : null}
    </form>
  );
}