# syntax = docker/dockerfile:1

# Adjust NODE_VERSION as desired
ARG NODE_VERSION=22.21.1
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="Node.js"

# Node.js app lives here
WORKDIR /app

# Set production environment
ENV NODE_ENV="production"

# Install packages needed to build node modules
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y \
    build-essential \
    python3 \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*


# Throw-away build stage to reduce size of final image
FROM base AS build

# Copy root package files first (for workspace dependencies)
COPY package.json package-lock.json ./
# Copy back folder package files
COPY back/package.json back/package-lock.json ./back/

# Install all dependencies using workspace mode
RUN npm ci --include=dev --workspace=back

# Copy application code
COPY back/ ./back/

# Build application
WORKDIR /app/back
RUN npm run build

# Move built app to root
RUN cp -r dist/* /app/ && \
    cp package.json /app/

# Remove node_modules and go back to root
WORKDIR /app
RUN rm -rf back/ node_modules/

# Install only production dependencies for the back package
RUN npm ci --omit=dev


# Final stage for app image
FROM base

# Copy built application from build stage
COPY --from=build /app /app

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD [ "npm", "run", "start" ]
