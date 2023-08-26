## Setting up

The `.env`-file has the default value for the API adress set in `VITE_API_BASE_URL`. It can be changed if needed.

When not using the docker-compose setup of the [main-repository](https://github.com/vktrrdk/nextflowAnalysis), using a virtual environment is suitable.
Install the packages from the `package.json` and switch the directory with `cd  nfAnalysisUI`.
Then simply run `npm run dev`.

Now the UI is available under `http://localhost:8001`, which is the default server set in the `vite.config.ts`.
If wished, the value can be adjusted there.