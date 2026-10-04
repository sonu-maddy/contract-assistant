export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

export class ApiError extends Error {
  constructor(message, { status = 0, code = "API_ERROR" } = {}) {
    super(message);

    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/* -------------------------------------------------------------------------- */
/* Response parsing                                                           */
/* -------------------------------------------------------------------------- */

async function parseResponse(response) {
  let data = null;

  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    try {
      const text = await response.text();

      data = text ? { error: text } : null;
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error ||
        data?.message ||
        `Request failed with status ${response.status}.`,
      {
        status: response.status,
        code: data?.code || `HTTP_${response.status}`,
      },
    );
  }

  return data;
}

/* -------------------------------------------------------------------------- */
/* Generic request                                                            */
/* -------------------------------------------------------------------------- */

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",

        ...(options.body
          ? {
              "Content-Type": "application/json",
            }
          : {}),

        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      "Unable to reach the server. Check your connection and make sure the backend is running.",
      {
        code: "NETWORK_ERROR",
      },
    );
  }

  return parseResponse(response);
}

/* -------------------------------------------------------------------------- */
/* Contracts                                                                  */
/* -------------------------------------------------------------------------- */

export async function listContracts() {
  return request("/api/contracts");
}

export async function getContract(contractId) {
  return request(`/api/contracts/${encodeURIComponent(contractId)}`);
}

export async function getContractSummary(contractId) {
  return request(`/api/contracts/${encodeURIComponent(contractId)}/summary`);
}

export async function getContractReminders(contractId) {
  return request(`/api/contracts/${encodeURIComponent(contractId)}/reminders`);
}

export async function createContract({ title, fileType, text, base64 }) {
  const body = {
    title,
    fileType,
  };

  if (base64) {
    body.document = base64;
    body.encoding = "base64";
  } else {
    body.text = text;
  }

  return request("/api/contracts", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* -------------------------------------------------------------------------- */
/* Create new version                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Upload a new version for an existing contract.
 *
 * Supported:
 * - txt
 * - pdf
 * - docx
 *
 * For PDF/DOCX, send base64.
 * For TXT, text can be sent directly.
 */
export async function createContractVersion({
  contractId,
  fileType,
  text,
  base64,
}) {
  if (!contractId) {
    throw new ApiError("Contract ID is required.", {
      code: "CONTRACT_ID_REQUIRED",
    });
  }

  if (!fileType) {
    throw new ApiError("File type is required.", {
      code: "FILE_TYPE_REQUIRED",
    });
  }

  const body = {
    fileType,
  };

  if (base64) {
    body.document = base64;
    body.encoding = "base64";
  } else {
    body.text = text;
  }

  return request(`/api/contracts/${encodeURIComponent(contractId)}/versions`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/* -------------------------------------------------------------------------- */
/* Items                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Get items directly by contract version.
 */
export async function getItems(contractVersionId) {
  if (!contractVersionId) {
    throw new ApiError("Contract version ID is required.", {
      code: "CONTRACT_VERSION_ID_REQUIRED",
    });
  }

  return request(
    `/api/items?contractVersionId=${encodeURIComponent(contractVersionId)}`,
  );
}

/**
 * Get items by contract ID.
 *
 * Backend automatically resolves
 * the latest version.
 */
export async function getItemsByContract(contractId) {
  if (!contractId) {
    throw new ApiError("Contract ID is required.", {
      code: "CONTRACT_ID_REQUIRED",
    });
  }

  return request(`/api/items?contractId=${encodeURIComponent(contractId)}`);
}

export async function getItem(itemId) {
  return request(`/api/items/${encodeURIComponent(itemId)}`);
}

export async function approveItem(itemId) {
  return request(`/api/items/${encodeURIComponent(itemId)}/approve`, {
    method: "PATCH",
  });
}

export async function rejectItem(itemId) {
  return request(`/api/items/${encodeURIComponent(itemId)}/reject`, {
    method: "PATCH",
  });
}

export async function editItem(itemId, changes) {
  return request(`/api/items/${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

export async function getContractVersions(contractId) {
  return request(`/api/contracts/${contractId}/versions`);
}
