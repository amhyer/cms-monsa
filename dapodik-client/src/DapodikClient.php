<?php

class DapodikClient
{
    private string $npsn;
    private string $token;
    private string $baseUrl;
    private string $protocol;
    private int $timeout;

    public function __construct(string $npsn, string $token, string $host = 'localhost', int $port = 5774, string $protocol = 'http', int $timeout = 30, bool $allowInsecureInProduction = false)
    {
        $this->npsn = $npsn;
        $this->token = $token;
        $this->protocol = $protocol;
        $this->timeout = $timeout;
        $this->baseUrl = "{$protocol}://{$host}:{$port}/WebService";

        // Guard: HTTP di production tidak diizinkan kecuali allowInsecureInProduction=true
        $isProduction = (isset($_ENV['APP_ENV']) && $_ENV['APP_ENV'] === 'production') ||
                        (isset($_SERVER['APP_ENV']) && $_SERVER['APP_ENV'] === 'production') ||
                        (function_exists('getenv') && getenv('APP_ENV') === 'production');
        if ($isProduction && $protocol === 'http' && !$allowInsecureInProduction) {
            throw new Exception(
                'DapodikClient: Protocol HTTP tidak diizinkan di production. ' .
                'Gunakan HTTPS atau set allowInsecureInProduction=true (hanya untuk internal VPN terenkripsi).'
            );
        }
    }

    public function getSekolah(): array
    {
        return $this->request('DataSekolah', ['npsn' => $this->npsn]);
    }

    public function getPesertaDidik(): array
    {
        return $this->request('DataPesertaDidik', ['npsn' => $this->npsn]);
    }

    public function getGTK(): array
    {
        return $this->request('DataGTK', ['npsn' => $this->npsn]);
    }

    public function getRombonganBelajar(): array
    {
        return $this->request('DataRombonganBelajar', ['npsn' => $this->npsn]);
    }

    public function testConnection(): bool
    {
        try {
            $this->getSekolah();
            return true;
        } catch (Exception $e) {
            return false;
        }
    }

    public function getAllData(): array
    {
        return [
            'sekolah' => $this->getSekolah(),
            'peserta_didik' => $this->getPesertaDidik(),
            'gtk' => $this->getGTK(),
            'rombel' => $this->getRombonganBelajar(),
        ];
    }

    private function request(string $endpoint, array $params = []): array
    {
        $url = $this->baseUrl . '/' . $endpoint;

        $ch = curl_init();
        $curlOpts = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . $this->token,
                'Content-Type: application/json',
            ],
        ];

        if ($this->protocol === 'https') {
            $curlOpts[CURLOPT_SSL_VERIFYPEER] = true;
        }

        curl_setopt_array($ch, $curlOpts);

        $response = curl_exec($ch);
        if (curl_errno($ch)) {
            throw new Exception('cURL error: ' . curl_error($ch));
        }

        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            throw new Exception("HTTP {$httpCode}: " . ($response ?: 'No response'));
        }

        $data = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception("Invalid JSON response: " . json_last_error_msg());
        }
        return $data;
    }
}
