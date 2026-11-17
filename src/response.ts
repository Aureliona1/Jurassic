/**
 * Create a 200 response with HTML contents.
 * @param html The HTML to send.
 */
export function htmlResponse(html: string): Response {
	return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}
