const ID = "bob_id_token";
const REFRESH = "bob_refresh_token";

export function getIdToken(): string | null {
  return localStorage.getItem(ID);
}

export function setTokens(idToken: string, refreshToken: string) {
  localStorage.setItem(ID, idToken);
  localStorage.setItem(REFRESH, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ID);
  localStorage.removeItem(REFRESH);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH);
}
