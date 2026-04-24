/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function askPregnancyAssistant(messages: {role: 'user' | 'assistant', content: string}[]) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Server API Error Data:", errorData);
      return `Erro na Assistente: ${errorData.error || response.statusText}`;
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Network or Fetch Error:", error);
    return "Ocorreu um erro ao comunicar com a assistente. Por favor, verifique a sua ligação ou tente novamente mais tarde.";
  }
}

