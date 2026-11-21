import type { RequestHandler } from 'express'
import type { CorsOptions as ViteCorsOptions } from 'vite'

import type { CorsOptions } from '../../index.js'

function setVary(response: Parameters<RequestHandler>[1], value: string) {
  const current = response.getHeader('Vary')
  const values = current === undefined ? [] : String(current).split(', ')
  if (!values.includes(value)) values.push(value)
  response.setHeader('Vary', values.join(', '))
}

function allowedOrigin(
  requestOrigin: string | undefined,
  options: CorsOptions,
) {
  const configured = options.origin
  if (configured === undefined) {
    if (options.credentials) return undefined
    return '*'
  }
  const origins = Array.isArray(configured) ? configured : [configured]
  if (origins.includes('*')) {
    return options.credentials ? undefined : '*'
  }
  if (
    requestOrigin !== undefined &&
    origins.some((origin) => {
      if (origin instanceof RegExp) {
        origin.lastIndex = 0
        return origin.test(requestOrigin)
      }
      return origin === requestOrigin
    })
  ) {
    return requestOrigin
  }
  return requestOrigin === undefined && origins.length === 1
    ? typeof origins[0] === 'string'
      ? origins[0]
      : undefined
    : undefined
}

export function createCorsMiddleware(
  config: boolean | string[] | CorsOptions | undefined,
): RequestHandler {
  if (config === false)
    return (_request, _response, next) => {
      next()
    }
  const options: CorsOptions =
    config === true || config === undefined
      ? {}
      : Array.isArray(config)
        ? { origin: config }
        : config
  const methods = options.methods ?? [
    'GET',
    'HEAD',
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
    'OPTIONS',
  ]

  return (request, response, next) => {
    const requestOrigin = request.get('Origin')
    const origin = allowedOrigin(requestOrigin, options)
    if (requestOrigin !== undefined && origin === undefined) {
      if (request.method === 'OPTIONS') {
        response.status(403).end()
        return
      }
      next()
      return
    }

    if (origin !== undefined) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      if (origin !== '*') setVary(response, 'Origin')
    }
    if (options.credentials && origin !== '*') {
      response.setHeader('Access-Control-Allow-Credentials', 'true')
    }
    if (options.exposedHeaders !== undefined) {
      response.setHeader(
        'Access-Control-Expose-Headers',
        Array.isArray(options.exposedHeaders)
          ? options.exposedHeaders.join(', ')
          : options.exposedHeaders,
      )
    }

    if (request.method === 'OPTIONS') {
      response.setHeader(
        'Access-Control-Allow-Methods',
        Array.isArray(methods) ? methods.join(', ') : methods,
      )
      response.setHeader(
        'Access-Control-Allow-Headers',
        options.allowedHeaders === undefined
          ? (request.get('Access-Control-Request-Headers') ?? '*')
          : Array.isArray(options.allowedHeaders)
            ? options.allowedHeaders.join(', ')
            : options.allowedHeaders,
      )
      if (options.maxAge !== undefined) {
        response.setHeader('Access-Control-Max-Age', String(options.maxAge))
      }
      if (options.preflightContinue) {
        next()
        return
      }
      response.status(options.optionsSuccessStatus ?? 204).end()
      return
    }

    next()
  }
}

export function viteCorsOptions(
  config: boolean | string[] | CorsOptions | ViteCorsOptions | undefined,
): boolean | ViteCorsOptions {
  if (config === undefined || config === true) return true
  if (config === false) return false
  return Array.isArray(config) ? { origin: config } : config
}
