/* Cliente adaptado de SoqueTIC-Client v1.4.2.
MIT License

Copyright (c) 2024 Julián Zylber

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
class SoqueticError extends Error {
  constructor(message) {
    super(message);
    this.name = "SoqueticError";
  }
}

const localHosts = ["localhost", "127.0.0.1", "[::1]", ""];
const backendUrl = localHosts.includes(location.hostname)
  ? "http://localhost:3000"
  : location.origin;

const socket = io(backendUrl, {
  autoConnect: false,
});

socket.on("connect", () => {
  console.log("¡Conectado al backend!");
});

socket.on("connect_error", () => {
  throw new SoqueticError(
    "Error al conectar al backend. Revisá que el servidor no haya crasheado y esté corriendo en el puerto correcto.\nRecargá la página para reconectar."
  );
});

socket.on("disconnect", () => {
  throw new SoqueticError(
    "Te desconectaste del backend. Revisá que el servidor esté corriendo sin errores y recargá la página para reconectar."
  );
});

/**
 * Verifica si el socket está activo antes de enviar un evento.
 *
 * @param {Object} socket - El objeto socket que se desea verificar.
 * @throws {SoqueticError} Si el socket no está activo y no hay conexión al backend.
 */
const assertConnection = (socket) => {
  if (!socket.active) {
    throw new SoqueticError(
      "No se puede enviar un evento si no hay conexión al backend.\nRecordá que tenés que llamar a connect2Server() para conectarte al backend."
    );
  }
};

/**
 * Verifica que el parámetro `type` sea de tipo string.
 *
 * @param {*} type - El valor a verificar como string.
 * @throws {SoqueticError} Si `type` no es de tipo string.
 */
const assertTypeIsString = (type) => {
  if (typeof type !== "string") {
    throw new SoqueticError(
      `El nombre del evento debe ser un string, pero es de tipo ${typeof type}`
    );
  }
};

/**
 * Verifica que el parámetro proporcionado sea una función.
 *
 * @param {*} callback - El valor que se desea verificar como función.
 * @throws {SoqueticError} Si el parámetro no es una función.
 */
const assertCallbackIsFunction = (callback) => {
  if (typeof callback !== "function") {
    throw new SoqueticError(
      `El callback debe ser una función, pero es de tipo ${typeof callback}`
    );
  }
};

/**
 * Decodifica una cadena de consulta (query string) en un objeto con sus parámetros.
 *
 * @param {string} queryString - La cadena de consulta a decodificar.
 * @returns {Object|undefined} Un objeto con los parámetros decodificados, o undefined si no hay parámetros.
 */
const decodeQueryString = (queryString) => {
  const params = new URLSearchParams(queryString);
  const decoded = {};
  for (const [key, value] of params.entries()) {
    decoded[key] = decodeURIComponent(value);
  }
  return Object.keys(decoded).length > 0 ? decoded : undefined;
};

/**
 * Decora una función callback para manejar respuestas de solicitudes front - back.
 * Verifica que la respuesta tenga un estado 200, de lo contrario lanza un error personalizado.
 * Si la respuesta es exitosa, llama al callback con los datos de la respuesta.
 *
 * @param {Function} callback - Función que será llamada con los datos de la respuesta.
 * @returns {Function} Función decorada que procesa la respuesta y ejecuta el callback.
 * @throws {SoqueticError} Si el estado de la respuesta no es 200.
 */
const RESTCallbackDecorator = (callback) => {
  assertCallbackIsFunction(callback);
  return (response) => {
    if (response.status !== 200) {
      throw new SoqueticError(
        response.message ? response.message : "Error desconocido"
      );
    }
    callback(response.data);
  };
};

// Wait for the server's acknowledgement before leaving the current page.
const postEventAsync = (event, data) => {
  assertConnection(socket);
  return new Promise((resolve, reject) => {
    socket.timeout(10000).emit(`POST:${event}`, { data }, (error, response) => {
      if (error) return reject(error);
      if (response.status !== 200 || response.data?.error) {
        return reject(new SoqueticError(response.data?.error || response.message || "Error del servidor"));
      }
      resolve(response.data);
    });
  });
};

/**
 * Asocia una función a un evento de tipo "Realtime" proveniente del backend.
 *
 * @param {string} event - El nombre del evento a suscribirse.
 * @param {function} callback - La función que se ejecutará cuando se reciba el evento. Toma un parámetro `data` (objeto con los datos enviados desde el backend).
 *
 * La documentación completa está en la {@link https://cheatsheets-nv.vercel.app/cheatsheet/soquetic#subscriberealtimeevent cheatsheet}.
 */
const subscribeRealTimeEvent = (event, callback) => {
  assertConnection(socket);
  assertTypeIsString(event);
  socket.on(`RT:${event}`, (data) => {
    return callback(data);
  });
};

/**
 * Envía un evento GET a través de soquetic.
 *
 * @param {string} event - El nombre del evento, puede incluir una cadena de consulta (query string).
 * @param {Function} callback - Función que se ejecuta cuando se recibe la respuesta del servidor. Toma un parámetro `data` (objeto con los datos de la respuesta).
 *
 * La documentación completa está en la {@link https://cheatsheets-nv.vercel.app/cheatsheet/soquetic#getevent cheatsheet}.
 */
const getEvent = (event, callback) => {
  assertConnection(socket);
  assertTypeIsString(event);
  const [type, ...rest] = event.split("?");
  const queryString = rest.join("?");
  const decodedQuery = decodeQueryString(queryString);
  const payload = { query: decodedQuery };
  socket.emit(`GET:${type}`, payload, RESTCallbackDecorator(callback));
};

/**
 * Envía un evento de tipo POST a través de soquetic con los datos.
 *
 * @param {string} event - El nombre del evento, puede incluir una cadena de consulta (query string).
 * @param {*} data - Los datos que se enviarán con el evento.
 * @param {Function} [callback=() => {}] - (OPCIONAL) Función que se ejecuta al recibir la respuesta. Toma un parámetro `data` (objeto con los datos de la respuesta).
 *
 * La documentación completa está en la {@link https://cheatsheets-nv.vercel.app/cheatsheet/soquetic#postevent cheatsheet}.
 */
const postEvent = (event, data, callback = () => {}) => {
  assertConnection(socket);
  assertTypeIsString(event);
  const [type, ...rest] = event.split("?");
  const queryString = rest.join("?");
  const decodedQuery = decodeQueryString(queryString);
  const payload = { data, query: decodedQuery };
  socket.emit(`POST:${type}`, payload, RESTCallbackDecorator(callback));
};

/**
 * Se conecta con el backend mediante soquetic. Debe ser invocada antes de enviar o recibir eventos.
 *
 * @param {number} [PORT=3000] - (OPCIONAL) El puerto al que se conectará el servidor.
 *
 * La documentación completa está en la {@link https://cheatsheets-nv.vercel.app/cheatsheet/soquetic#connect2server cheatsheet}.
 */
const connect2Server = (PORT = 3000) => {
  if (localHosts.includes(location.hostname)) {
    socket.io.uri = `http://localhost:${PORT}`;
  }
  socket.connect();
};
