import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const loginSchema = z.object({
  username: z.string().min(1, { message: "Nome de usuário obrigatório" }),
  password: z.string().min(1, { message: "Senha obrigatória" }),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(4, { message: "A senha deve ter no mínimo 4 caracteres" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [tab, setTab] = useState<string>("login");
  const [_, navigate] = useLocation();
  const { user, loginMutation, registerMutation } = useAuth();
  
  // Redirect to home if already logged in
  useEffect(() => {
    if (user) {
      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/department/dashboard");
      }
    }
  }, [user, navigate]);
  
  // Login form
  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });
  
  // Register form
  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      name: "",
      role: "admin",
    },
  });
  
  const onLoginSubmit = async (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };
  
  const onRegisterSubmit = async (data: RegisterFormValues) => {
    // Remove confirmPassword as it's not in the schema
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-primary-50 to-neutral-100">
      {/* Left Column - Form */}
      <div className="flex-1 flex items-center justify-center p-4 md:p-8">
        <Card className="w-full max-w-md mx-auto">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-2">
              <div className="bg-primary-500 text-white rounded-md p-2">
                <i className="ri-shirt-line text-2xl"></i>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Fábrica de Camisas</CardTitle>
            <CardDescription className="text-center">
              Acesse o sistema de gerenciamento de produção
            </CardDescription>
          </CardHeader>
          
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(onLoginSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de Usuário</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Digite seu nome de usuário" 
                              autoComplete="username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="Digite sua senha" 
                              autoComplete="current-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={loginMutation.isPending}
                    >
                      {loginMutation.isPending ? "Entrando..." : "Entrar"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="register">
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Digite seu nome completo" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome de Usuário</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="Digite um nome de usuário" 
                              autoComplete="username"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Função</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione uma função" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Administrador</SelectItem>
                              <SelectItem value="gabarito">Gabarito</SelectItem>
                              <SelectItem value="impressao">Impressão</SelectItem>
                              <SelectItem value="batida">Batida</SelectItem>
                              <SelectItem value="costura">Costura</SelectItem>
                              <SelectItem value="embalagem">Embalagem</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="Digite uma senha" 
                              autoComplete="new-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={registerForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Senha</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              type="password" 
                              placeholder="Confirme sua senha" 
                              autoComplete="new-password"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? "Cadastrando..." : "Cadastrar"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
      
      {/* Right Column - Hero */}
      <div className="flex-1 bg-gradient-to-br from-primary-700 to-primary-900 p-8 flex flex-col justify-center text-white hidden md:flex">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <i className="ri-shirt-line text-6xl"></i>
          </div>
          
          <h1 className="text-3xl font-bold mb-4">
            Sistema de Gerenciamento de Produção
          </h1>
          
          <p className="text-lg mb-6 text-primary-100">
            Acompanhe todo o fluxo de trabalho da fábrica, desde o gabarito até a embalagem.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-4">
                <i className="ri-check-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-medium">Fluxo Organizado</h3>
                <p className="text-sm text-primary-100">
                  Mantenha o controle sequencial de todas as etapas de produção.
                </p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-4">
                <i className="ri-notification-3-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-medium">Notificações</h3>
                <p className="text-sm text-primary-100">
                  Receba alertas quando as atividades forem concluídas.
                </p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center mr-4">
                <i className="ri-file-list-3-line text-xl"></i>
              </div>
              <div>
                <h3 className="font-medium">Rastreabilidade</h3>
                <p className="text-sm text-primary-100">
                  Saiba quem realizou cada etapa e quando foi concluída.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
