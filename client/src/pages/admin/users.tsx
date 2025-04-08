import { useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Search, Plus, Edit, Trash2, MoreHorizontal } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

const userFormSchema = z.object({
  username: z.string().min(1, { message: "Nome de usuário obrigatório" }),
  name: z.string().min(1, { message: "Nome completo obrigatório" }),
  role: z.string(),
  password: z.string().optional(),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export default function AdminUsers() {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [currentEditId, setCurrentEditId] = useState<number | null>(null);
  
  // Fetch users
  const { 
    data: users = [], 
    isLoading, 
    error 
  } = useQuery({
    queryKey: ["/api/users"],
  });
  
  // Form
  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: "",
      name: "",
      role: "admin",
      password: "",
    },
  });
  
  // Filter users based on search
  const filteredUsers = users.filter((user: any) => {
    return (
      user.username.toLowerCase().includes(search.toLowerCase()) ||
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.role.toLowerCase().includes(search.toLowerCase())
    );
  });
  
  // Create/Update user mutation
  const userMutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (currentEditId) {
        // If password is empty, remove it from the object
        if (!values.password) {
          const { password, ...userData } = values;
          return await apiRequest("PUT", `/api/users/${currentEditId}`, userData);
        }
        return await apiRequest("PUT", `/api/users/${currentEditId}`, values);
      } else {
        // Ensure password is provided for new users
        if (!values.password) {
          throw new Error("Senha é obrigatória para novos usuários");
        }
        return await apiRequest("POST", "/api/register", values);
      }
    },
    onSuccess: () => {
      toast({
        title: currentEditId ? "Usuário atualizado" : "Usuário criado",
        description: currentEditId ? "Usuário atualizado com sucesso" : "Usuário criado com sucesso",
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao processar sua solicitação",
        variant: "destructive",
      });
    },
  });
  
  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Usuário excluído",
        description: "Usuário excluído com sucesso",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Ocorreu um erro ao excluir o usuário",
        variant: "destructive",
      });
    },
  });
  
  // Handle edit user
  const handleEditUser = (user: any) => {
    setCurrentEditId(user.id);
    form.reset({
      username: user.username,
      name: user.name,
      role: user.role,
      password: "",
    });
    setIsDialogOpen(true);
  };
  
  // Handle new user
  const handleNewUser = () => {
    setCurrentEditId(null);
    form.reset({
      username: "",
      name: "",
      role: "admin",
      password: "",
    });
    setIsDialogOpen(true);
  };
  
  // Handle delete user
  const handleDeleteUser = (id: number) => {
    if (id === currentUser?.id) {
      toast({
        title: "Operação não permitida",
        description: "Você não pode excluir seu próprio usuário",
        variant: "destructive",
      });
      return;
    }
    
    if (window.confirm("Tem certeza que deseja excluir este usuário?")) {
      deleteUserMutation.mutate(id);
    }
  };
  
  // Handle form submission
  const onSubmit = (values: UserFormValues) => {
    userMutation.mutate(values);
  };

  // Format role name
  const formatRole = (role: string) => {
    switch (role) {
      case "admin": return "Administrador";
      case "gabarito": return "Gabarito";
      case "impressao": return "Impressão";
      case "batida": return "Batida";
      case "costura": return "Costura";
      case "embalagem": return "Embalagem";
      default: return role;
    }
  };
  
  return (
    <Layout title="Usuários">
      {/* Actions Row */}
      <div className="flex flex-col sm:flex-row justify-between mb-6 gap-3">
        <h2 className="text-xl font-semibold text-neutral-800">Gerenciar Usuários</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <Input 
              placeholder="Buscar usuários..." 
              className="w-full sm:w-64 pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
          </div>
          
          <Button 
            className="bg-primary-700 hover:bg-primary-800"
            onClick={handleNewUser}
          >
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>
      </div>
      
      {/* Users List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Lista de Usuários</CardTitle>
        </CardHeader>
        
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
            </div>
          ) : error ? (
            <div className="p-4 text-center">
              <p className="text-red-500">Erro ao carregar usuários. Tente novamente mais tarde.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-neutral-500">Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left font-medium p-3">Nome</th>
                    <th className="text-left font-medium p-3">Usuário</th>
                    <th className="text-left font-medium p-3">Função</th>
                    <th className="text-right font-medium p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user: any) => (
                    <tr key={user.id} className="border-b hover:bg-neutral-50">
                      <td className="p-3">{user.name}</td>
                      <td className="p-3">{user.username}</td>
                      <td className="p-3">
                        <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium">
                          {formatRole(user.role)}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleDeleteUser(user.id)}
                          disabled={user.id === currentUser?.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentEditId ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            <DialogDescription>
              {currentEditId ? "Atualize os detalhes do usuário abaixo." : "Preencha os detalhes para criar um novo usuário."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Digite o nome completo" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome de Usuário</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Digite o nome de usuário" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Função</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
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
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {currentEditId ? "Senha (deixe em branco para manter a atual)" : "Senha"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        {...field} 
                        placeholder={currentEditId ? "Digite a nova senha" : "Digite a senha"} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={userMutation.isPending}
                >
                  {userMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {currentEditId ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
