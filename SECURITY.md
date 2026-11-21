# Security policy

Report vulnerabilities privately through the GitHub repository's Security tab when private vulnerability reporting is enabled. If the reporting form is unavailable, contact a maintainer privately and keep exploit details out of public issues.

The renderer executes the project's Vue components, configuration and Vite plugins with the Node process's permissions. Run trusted projects and restrict access if you bind the listener to a network interface. The built-in HTTP service has no authentication. The [architecture notes](docs/architecture.md) describe which data crosses the request boundary.

The development HTTP routes apply Vite's resolved `server.allowedHosts` policy before rendering or serving assets. Setting `allowedHosts: true` permits every host. Expose public traffic through your backend and keep the development server private.

An entry factory controls how external data reaches the Vue app. Select and validate the props it forwards, particularly values used for links or raw HTML. Production render workers have V8 heap limits and deadlines. OS permissions and limits still govern native memory, filesystem access and network access.
